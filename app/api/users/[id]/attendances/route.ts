import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deriveStatusFromTimes } from "@/lib/attendance-status"

async function hasScheduleForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string
): Promise<boolean> {
  const normalizedDate = dateStr.slice(0, 10)
  const date = new Date(normalizedDate + "T00:00:00")
  const dayOfWeek = date.getDay()
  const { data } = await supabase
    .from("schedules")
    .select("id, custom_date, day_of_week")
    .eq("user_id", userId)
  const rows = data ?? []
  const customMatch = rows.find((r) => {
    const cd = (r as { custom_date?: string | null }).custom_date
    return cd ? String(cd).slice(0, 10) === normalizedDate : false
  })
  const recurringMatch = rows.find((r) => {
    const dow = (r as { day_of_week?: number | null }).day_of_week
    return typeof dow === "number" && dow >= 0 && dow <= 6 && dow === dayOfWeek
  })
  return !!(customMatch ?? recurringMatch)
}

async function getScheduledDatesInRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fromStr: string,
  toStr: string
): Promise<string[]> {
  const { data } = await supabase
    .from("schedules")
    .select("day_of_week, custom_date")
    .eq("user_id", userId)
  const rows = data ?? []
  const dates = new Set<string>()
  const fromDate = new Date(fromStr + "T12:00:00")
  const toDate = new Date(toStr + "T12:00:00")
  const normalizedCustomDates = new Map<string, boolean>()
  for (const r of rows) {
    const cd = (r as { custom_date?: string | null }).custom_date
    if (cd && typeof cd === "string") {
      normalizedCustomDates.set(cd.slice(0, 10), true)
    }
  }
  const recurringDays = new Set(
    rows
      .filter((r) => {
        const dow = (r as { day_of_week?: number | null }).day_of_week
        return typeof dow === "number" && dow >= 0 && dow <= 6
      })
      .map((r) => (r as { day_of_week: number }).day_of_week)
  )
  const pad = (n: number) => String(n).padStart(2, "0")
  const cur = new Date(fromDate)
  while (cur <= toDate) {
    const dateStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`
    const dayOfWeek = cur.getDay()
    const hasCustomMatch = normalizedCustomDates.has(dateStr)
    const hasRecurringMatch = recurringDays.has(dayOfWeek)
    if (hasCustomMatch || hasRecurringMatch) {
      dates.add(dateStr)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return Array.from(dates)
}

async function getScheduledTimeInForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string
): Promise<string> {
  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay()
  const { data } = await supabase
    .from("schedules")
    .select("time_in, custom_date, day_of_week")
    .eq("user_id", userId)
  const rows = data ?? []
  const customMatch = rows.find((r) => (r as { custom_date?: string }).custom_date === dateStr)
  const recurringMatch = rows.find((r) => (r as { day_of_week?: number }).day_of_week === dayOfWeek)
  const match = customMatch ?? recurringMatch
  if (!match) return "09:00"
  const timeIn = (match as { time_in?: string }).time_in
  if (!timeIn) return "09:00"
  const s = String(timeIn)
  const parts = s.split(":")
  const h = (parts[0] ?? "09").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
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
    const todayStr = new Date().toISOString().slice(0, 10)

    const { data: userRow } = await supabase
      .from("users")
      .select("start_date")
      .eq("id", userId)
      .maybeSingle()
    const startDate = (userRow as { start_date?: string | null } | null)?.start_date ?? null

    const scheduledDates = await getScheduledDatesInRange(supabase, userId, from, to)
    const { data: existingAttByDate } = await supabase
      .from("attendances")
      .select("attendance_date")
      .eq("user_id", userId)
      .gte("attendance_date", from)
      .lte("attendance_date", to)
    const existingDates = new Set((existingAttByDate ?? []).map((r) => r.attendance_date))

    const toInsert: { user_id: string; attendance_date: string; status: string }[] = []
    for (const dateStr of scheduledDates) {
      if (dateStr > todayStr) continue
      if (startDate != null && dateStr < startDate) continue
      if (existingDates.has(dateStr)) continue
      toInsert.push({
        user_id: userId,
        attendance_date: dateStr,
        status: "absent",
      })
    }
    if (toInsert.length > 0) {
      await supabase.from("attendances").upsert(toInsert, {
        onConflict: "user_id,attendance_date",
        ignoreDuplicates: true,
      })
    }

    const selectFields = "id, user_id, attendance_date, status, time_in, time_out, approval_status, remarks"

    const { data: listData, error: listError, count } = await supabase
      .from("attendances")
      .select(selectFields, { count: "exact" })
      .eq("user_id", userId)
      .gte("attendance_date", from)
      .lte("attendance_date", to)
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

    const attendanceIds = (listData ?? []).map((r) => r.id)
    const correctionMap = new Map<string, { status: string; id: string }>()
    if (attendanceIds.length > 0) {
      const { data: corrections } = await supabase
        .from("attendance_corrections")
        .select("id, attendance_id, status, created_at")
        .eq("user_id", userId)
        .in("attendance_id", attendanceIds)
        .order("created_at", { ascending: false })
      const seen = new Set<string>()
      for (const c of corrections ?? []) {
        if (!seen.has(c.attendance_id)) {
          seen.add(c.attendance_id)
          correctionMap.set(c.attendance_id, { status: c.status, id: c.id })
        }
      }
    }

    const rows = (listData ?? []).map((row) => {
      const corr = correctionMap.get(row.id)
      const rawDate = row.attendance_date
      const date =
        typeof rawDate === "string"
          ? rawDate.slice(0, 10)
          : rawDate
            ? String(rawDate).slice(0, 10)
            : rawDate
      return {
        id: row.id,
        userId: row.user_id,
        date,
        status: row.status as "present" | "late" | "absent" | "incomplete",
        approvalStatus: (row.approval_status ?? "pending") as "pending" | "approved" | "denied",
        timeIn: row.time_in ? formatTime(row.time_in) : null,
        timeOut: row.time_out ? formatTime(row.time_out) : null,
        remarks: (row as { remarks?: string | null }).remarks ?? null,
        correctionStatus: corr?.status ?? null,
        correctionId: corr?.id ?? null,
      }
    })

    const statsRows = statsData ?? []
    const stats = {
      present: statsRows.filter((r) => r.status === "present").length,
      late: statsRows.filter((r) => r.status === "late").length,
      absent: statsRows.filter((r) => r.status === "absent").length,
      incomplete: statsRows.filter((r) => r.status === "incomplete").length,
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
      status?: "present" | "late" | "absent" | "incomplete"
      timeIn?: string
      timeOut?: string
    }

    if (!date?.trim()) {
      return NextResponse.json({ error: "date is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const hasSchedule = await hasScheduleForDate(supabase, userId, date.trim())
    if (!hasSchedule) {
      return NextResponse.json(
        { error: "No schedule for this date. Attendance can only be recorded for scheduled days." },
        { status: 400 }
      )
    }

    const ti = timeIn?.trim() || null
    const to = timeOut?.trim() || null
    let derivedStatus: "present" | "late" | "absent" | "incomplete"
    if (ti || to) {
      const scheduledTimeIn = await getScheduledTimeInForDate(supabase, userId, date.trim())
      derivedStatus = deriveStatusFromTimes({
        timeIn: ti,
        timeOut: to,
        scheduledTimeIn,
      })
    } else {
      if (!status) {
        return NextResponse.json({ error: "status is required when no times provided" }, { status: 400 })
      }
      if (!["present", "late", "absent", "incomplete"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      derivedStatus = status as "present" | "late" | "absent" | "incomplete"
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      attendance_date: date.trim(),
      status: derivedStatus,
    }
    if (ti) insertPayload.time_in = ti
    if (to) insertPayload.time_out = to

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
