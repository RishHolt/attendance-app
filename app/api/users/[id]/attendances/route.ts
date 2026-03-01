import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function hasScheduleForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string
): Promise<boolean> {
  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay()
  const { data } = await supabase
    .from("schedules")
    .select("id, custom_date, day_of_week")
    .eq("user_id", userId)
  const rows = data ?? []
  const customMatch = rows.find((r) => (r as { custom_date?: string }).custom_date === dateStr)
  const recurringMatch = rows.find((r) => (r as { day_of_week?: number }).day_of_week === dayOfWeek)
  return !!(customMatch ?? recurringMatch)
}

function formatTime(v: string | null): string {
  if (!v) return "00:00"
  const s = String(v)
  const parts = s.split(":")
  const h = (parts[0] ?? "00").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const pageParam = searchParams.get("page")
    const limitParam = searchParams.get("limit")
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
    const limit = Math.min(1000, Math.max(1, parseInt(limitParam ?? "50", 10) || 50))
    const offset = (page - 1) * limit

    if (!from || !to) {
      return NextResponse.json(
        { error: "Query params from and to (YYYY-MM-DD) required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const selectFields = "id, user_id, attendance_date, status, time_in, time_out, approval_status, remarks"

    const baseQuery = supabase
      .from("attendances")
      .select(selectFields, { count: "exact" })
      .eq("user_id", userId)
      .gte("attendance_date", from)
      .lte("attendance_date", to)

    const { data: listData, error: listError, count } = await baseQuery
      .order("attendance_date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const { data: statsData } = await supabase
      .from("attendances")
      .select("status")
      .eq("user_id", userId)
      .gte("attendance_date", from)
      .lte("attendance_date", to)

    const rows = (listData ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: row.attendance_date,
      status: row.status as "present" | "late" | "absent",
      approvalStatus: (row.approval_status ?? "pending") as "pending" | "approved" | "denied",
      timeIn: row.time_in ? formatTime(row.time_in) : null,
      timeOut: row.time_out ? formatTime(row.time_out) : null,
      remarks: (row as { remarks?: string | null }).remarks ?? null,
    }))

    const statsRows = statsData ?? []
    const stats = {
      present: statsRows.filter((r) => r.status === "present").length,
      late: statsRows.filter((r) => r.status === "late").length,
      absent: statsRows.filter((r) => r.status === "absent").length,
    }

    return NextResponse.json({
      rows,
      total: count ?? 0,
      stats,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch attendances" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const body = await request.json()
    const { date, status, timeIn, timeOut } = body as {
      date?: string
      status?: "present" | "late" | "absent"
      timeIn?: string
      timeOut?: string
    }

    if (!date?.trim() || !status) {
      return NextResponse.json(
        { error: "date and status are required" },
        { status: 400 }
      )
    }

    if (!["present", "late", "absent"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabase = await createClient()
    if (timeIn?.trim()) {
      const hasSchedule = await hasScheduleForDate(supabase, userId, date.trim())
      if (!hasSchedule) {
        return NextResponse.json(
          { error: "You have no schedule for this date. Please contact your admin to set up your schedule." },
          { status: 400 }
        )
      }
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      attendance_date: date.trim(),
      status,
    }
    if (timeIn?.trim()) insertPayload.time_in = timeIn.trim()
    if (timeOut?.trim()) insertPayload.time_out = timeOut.trim()

    const { data, error } = await supabase
      .from("attendances")
      .insert(insertPayload)
      .select("id, user_id, attendance_date, status, time_in, time_out")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Attendance already exists for this date" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        id: data.id,
        userId: data.user_id,
        date: data.attendance_date,
        status: data.status,
        timeIn: data.time_in ? formatTime(data.time_in) : null,
        timeOut: data.time_out ? formatTime(data.time_out) : null,
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create attendance" },
      { status: 500 }
    )
  }
}
