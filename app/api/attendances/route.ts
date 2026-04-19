import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { formatTime24 } from "@/lib/format-time"
import { getDefaultDateRange } from "@/lib/date-utils"
import type { AdminAttendanceRow } from "@/types"

export type { AdminAttendanceRow }

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const approvalStatus = searchParams.get("approval_status")
    const statusFilter = searchParams.get("status")
    const search = searchParams.get("search")?.trim() ?? ""
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const pageParam = searchParams.get("page")
    const limitParam = searchParams.get("limit")
    const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
    const from = fromParam || defaultFrom
    const to = toParam || defaultTo
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? "10", 10) || 10))
    const offset = (page - 1) * limit

    let userIdsFilter: string[] | null = null
    if (search.length > 0) {
      const searchPattern = `*${search}*`
      const { data: usersData } = await supabase
        .from("users")
        .select("id")
        .or(`full_name.ilike.${searchPattern},user_id.ilike.${searchPattern}`)
      const ids = (usersData ?? []).map((u) => u.id)
      if (ids.length === 0) {
        return NextResponse.json({ rows: [], total: 0 })
      }
      userIdsFilter = ids
    }

    let query = supabase
      .from("attendances")
      .select(
        `
        id,
        user_id,
        attendance_date,
        status,
        approval_status,
        time_in,
        time_out,
        remarks
      `,
        { count: "exact" }
      )
      .order("attendance_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (approvalStatus === "pending" || approvalStatus === "approved" || approvalStatus === "denied") {
      if (approvalStatus === "pending") {
        // Treat NULL approval_status as "pending" for backwards compatibility
        query = query.or("approval_status.eq.pending,approval_status.is.null").not("time_out", "is", null)
      } else {
        query = query.eq("approval_status", approvalStatus)
      }
    }
    if (statusFilter === "incomplete") {
      query = query
        .eq("status", "incomplete")
        // Treat NULL approval_status as "pending" so older rows and new clock-ins both show
        .or("approval_status.eq.pending,approval_status.is.null")
    }
    if (userIdsFilter && userIdsFilter.length > 0) {
      query = query.in("user_id", userIdsFilter)
    }
    if (approvalStatus !== "pending") {
      query = query.gte("attendance_date", from).lte("attendance_date", to)
    }
    query = query.range(offset, offset + limit - 1)

    const { data: attendancesData, error: attError, count } = await query

    if (attError) {
      if (attError.message?.toLowerCase().includes("approval_status")) {
        return NextResponse.json(
          { error: "Run migration: add approval_status to attendances table" },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: attError.message }, { status: 500 })
    }

    const attendanceRows = attendancesData ?? []
    const userIds = [...new Set(attendanceRows.map((a) => a.user_id))]

    if (userIds.length === 0) {
      return NextResponse.json({ rows: [], total: count ?? 0 })
    }

    const { data: usersData } = await supabase
      .from("users")
      .select("id, user_id, full_name")
      .in("id", userIds)

    const userMap = new Map(
      (usersData ?? []).map((u) => [u.id, { user_id: u.user_id, full_name: u.full_name }])
    )

    const rows: AdminAttendanceRow[] = attendanceRows.map((row) => {
      const user = userMap.get(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        userDisplayId: user?.user_id ?? "",
        fullName: user?.full_name ?? "Unknown",
        date: row.attendance_date,
        status: row.status as "present" | "late" | "absent" | "incomplete",
        approvalStatus: (row.approval_status ?? "pending") as "pending" | "approved" | "denied",
        timeIn: row.time_in ? formatTime24(row.time_in) : null,
        timeOut: row.time_out ? formatTime24(row.time_out) : null,
        remarks: (row as { remarks?: string | null }).remarks ?? null,
      }
    })

    return NextResponse.json({ rows, total: count ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch attendances" },
      { status: 500 }
    )
  }
}
