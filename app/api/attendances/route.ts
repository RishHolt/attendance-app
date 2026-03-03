import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function formatTime(v: string | null): string {
  if (!v) return "00:00"
  const s = String(v)
  const parts = s.split(":")
  const h = (parts[0] ?? "00").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

export type AdminAttendanceRow = {
  id: string
  userId: string
  userDisplayId: string
  fullName: string
  date: string
  status: "present" | "late" | "absent" | "incomplete"
  approvalStatus: "pending" | "approved" | "denied"
  timeIn: string | null
  timeOut: string | null
  remarks: string | null
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split("T")[0] ?? ""
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] ?? ""
  return { from, to }
}

export async function GET(request: Request) {
  try {
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

    const supabase = await createClient()

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
      query = query.eq("approval_status", approvalStatus)
      if (approvalStatus === "pending") {
        query = query.not("time_out", "is", null)
      }
    }
    if (statusFilter === "incomplete") {
      query = query
        .not("time_in", "is", null)
        .is("time_out", null)
        .eq("approval_status", "pending")
    }
    if (userIdsFilter && userIdsFilter.length > 0) {
      query = query.in("user_id", userIdsFilter)
    }
    query = query.gte("attendance_date", from).lte("attendance_date", to).range(offset, offset + limit - 1)

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
        timeIn: row.time_in ? formatTime(row.time_in) : null,
        timeOut: row.time_out ? formatTime(row.time_out) : null,
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
