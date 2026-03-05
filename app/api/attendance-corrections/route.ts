import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { formatTime24 } from "@/lib/format-time"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20))
    const offset = (page - 1) * limit

    let query = supabase
      .from("attendance_corrections")
      .select(
        `
        id,
        attendance_id,
        user_id,
        requested_time_in,
        requested_time_out,
        reason,
        status,
        created_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })

    if (status === "pending" || status === "approved" || status === "rejected") {
      query = query.eq("status", status)
    }
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const attendanceIds = [...new Set(rows.map((r) => r.attendance_id))]
    const userIds = [...new Set(rows.map((r) => r.user_id))]

    let attendanceMap = new Map<string, { date: string; timeIn: string | null; timeOut: string | null }>()
    let userMap = new Map<string, { fullName: string; userDisplayId: string }>()

    if (attendanceIds.length > 0) {
      const { data: attData } = await supabase
        .from("attendances")
        .select("id, attendance_date, time_in, time_out")
        .in("id", attendanceIds)
      attendanceMap = new Map(
        (attData ?? []).map((a) => [
          a.id,
          {
            date: a.attendance_date,
            timeIn: a.time_in ? formatTime24(a.time_in) : null,
            timeOut: a.time_out ? formatTime24(a.time_out) : null,
          },
        ])
      )
    }
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from("users")
        .select("id, full_name, user_id")
        .in("id", userIds)
      userMap = new Map(
        (userData ?? []).map((u) => [
          u.id,
          { fullName: u.full_name ?? "Unknown", userDisplayId: u.user_id ?? "" },
        ])
      )
    }

    const result = rows.map((r) => {
      const att = attendanceMap.get(r.attendance_id)
      const u = userMap.get(r.user_id)
      return {
        id: r.id,
        attendanceId: r.attendance_id,
        userId: r.user_id,
        fullName: u?.fullName ?? "Unknown",
        userDisplayId: u?.userDisplayId ?? "",
        date: att?.date ?? "",
        currentTimeIn: att?.timeIn ?? null,
        currentTimeOut: att?.timeOut ?? null,
        requestedTimeIn: r.requested_time_in ? formatTime24(r.requested_time_in) : null,
        requestedTimeOut: r.requested_time_out ? formatTime24(r.requested_time_out) : null,
        reason: r.reason ?? null,
        status: r.status,
        createdAt: r.created_at,
      }
    })

    return NextResponse.json({ rows: result, total: count ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch corrections" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const userId = userRow.id

    const body = await request.json()
    const { attendanceId, requestedTimeIn, requestedTimeOut, reason } = body as {
      attendanceId?: string
      requestedTimeIn?: string
      requestedTimeOut?: string
      reason?: string
    }

    if (!attendanceId?.trim()) {
      return NextResponse.json(
        { error: "attendanceId is required" },
        { status: 400 }
      )
    }

    const { data: att } = await supabase
      .from("attendances")
      .select("id, user_id, status, approval_status, time_in, time_out")
      .eq("id", attendanceId.trim())
      .single()

    if (!att || att.user_id !== userId) {
      return NextResponse.json(
        { error: "Attendance not found or access denied" },
        { status: 404 }
      )
    }

    let ti = requestedTimeIn?.trim() || null
    let to = requestedTimeOut?.trim() || null

    const currentTimeIn = att.time_in ? formatTime24(att.time_in) : null
    const hasNoTimeOut = !att.time_out

    if (
      hasNoTimeOut &&
      currentTimeIn &&
      to &&
      !ti
    ) {
      const toMinutes = (t: string) => {
        const [h, m] = t.split(":").map(Number)
        return (h ?? 0) * 60 + (m ?? 0)
      }
      if (toMinutes(to) < toMinutes(currentTimeIn)) {
        ti = to
        to = null
      }
    } else if (hasNoTimeOut && currentTimeIn && ti && to) {
      const toMinutes = (t: string) => {
        const [h, m] = t.split(":").map(Number)
        return (h ?? 0) * 60 + (m ?? 0)
      }
      if (
        toMinutes(to) < toMinutes(currentTimeIn) &&
        ti === currentTimeIn
      ) {
        ti = to
        to = null
      }
    }

    if (!ti && !to) {
      return NextResponse.json(
        { error: "At least requestedTimeIn or requestedTimeOut is required" },
        { status: 400 }
      )
    }

    const reasonTrimmed = reason?.trim()
    if (!reasonTrimmed) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      attendance_id: att.id,
      user_id: userId,
      status: "pending",
      reason: reasonTrimmed,
    }
    if (ti) insertPayload.requested_time_in = ti
    if (to) insertPayload.requested_time_out = to

    const { data: inserted, error } = await supabase
      .from("attendance_corrections")
      .insert(insertPayload)
      .select("id, attendance_id, status, created_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!inserted) {
      return NextResponse.json({ error: "Failed to create correction" }, { status: 500 })
    }
    return NextResponse.json(
      {
        id: inserted.id,
        attendanceId: inserted.attendance_id,
        status: inserted.status,
        createdAt: inserted.created_at,
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create correction" },
      { status: 500 }
    )
  }
}
