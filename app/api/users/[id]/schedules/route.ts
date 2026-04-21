import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth"
import { formatTime24 } from "@/lib/format-time"
import type { ScheduleRow } from "@/types"

export type { ScheduleRow }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    const schedulesRes = await supabase
      .from("schedules")
      .select("id, user_id, day_of_week, custom_date, time_in, time_out, break_time, break_duration")
      .eq("user_id", userId)
      .order("day_of_week", { ascending: true, nullsFirst: false })
      .order("custom_date", { ascending: true, nullsFirst: false })
      .order("time_in", { ascending: true })

    let defaultsData: { time_in: string; time_out: string; break_time: string | null; break_duration: number | null } | null = null
    try {
      const r = await supabase
        .from("user_schedule_defaults")
        .select("time_in, time_out, break_time, break_duration")
        .eq("user_id", userId)
        .maybeSingle()
      defaultsData = r.data
    } catch {
      defaultsData = null
    }

    if (schedulesRes.error) {
      return NextResponse.json({ error: schedulesRes.error.message }, { status: 500 })
    }

    const rows: ScheduleRow[] = (schedulesRes.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      dayOfWeek: row.day_of_week ?? null,
      customDate: row.custom_date ?? null,
      timeIn: formatTime24(row.time_in),
      timeOut: formatTime24(row.time_out),
      breakTime: row.break_time ? formatTime24(row.break_time) : null,
      breakDuration: row.break_duration ?? null,
    }))

    const recurring = rows.filter((r) => r.dayOfWeek !== null)
    let defaultTemplate: {
      timeIn: string
      timeOut: string
      breakTime: string | null
      breakDuration: number | null
    } | null = null

    if (defaultsData) {
      defaultTemplate = {
        timeIn: formatTime24(defaultsData.time_in),
        timeOut: formatTime24(defaultsData.time_out),
        breakTime: defaultsData.break_time ? formatTime24(defaultsData.break_time) : null,
        breakDuration:
          typeof defaultsData.break_duration === "number" && defaultsData.break_duration >= 0
            ? defaultsData.break_duration
            : null,
      }
    } else if (recurring.length > 0) {
      type Template = { timeIn: string; timeOut: string; breakTime: string | null; breakDuration: number | null }
      const counts = new Map<string, { count: number; t: Template }>()
      for (const r of recurring) {
        const t = {
          timeIn: r.timeIn,
          timeOut: r.timeOut,
          breakTime: r.breakTime ?? null,
          breakDuration: r.breakDuration ?? null,
        }
        const key = `${t.timeIn}|${t.timeOut}|${t.breakTime ?? ""}|${t.breakDuration ?? 0}`
        const ex = counts.get(key)
        if (ex) ex.count += 1
        else counts.set(key, { count: 1, t })
      }
      const best = [...counts.values()].reduce((a, b) => (b.count > a.count ? b : a))
      defaultTemplate = best.t
    }

    return NextResponse.json({ rows, defaultTemplate })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch schedules" },
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
    const {
      dayOfWeek,
      customDate,
      timeIn,
      timeOut,
      breakTime,
      breakDuration,
    } = body as {
      dayOfWeek?: number | null
      customDate?: string | null
      timeIn?: string
      timeOut?: string
      breakTime?: string | null
      breakDuration?: number | null
    }

    if (!timeIn || !timeOut) {
      return NextResponse.json(
        { error: "timeIn and timeOut are required" },
        { status: 400 }
      )
    }

    const isCustom = !!customDate
    if (isCustom) {
      if (
        typeof dayOfWeek === "number" ||
        (dayOfWeek !== undefined && dayOfWeek !== null)
      ) {
        return NextResponse.json(
          { error: "Provide either dayOfWeek or customDate, not both" },
          { status: 400 }
        )
      }
    } else {
      if (
        typeof dayOfWeek !== "number" ||
        dayOfWeek < 0 ||
        dayOfWeek > 6
      ) {
        return NextResponse.json(
          { error: "dayOfWeek (0–6) is required for recurring schedules" },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const adminClient = createAdminClient()
    const insertPayload = {
      user_id: userId,
      day_of_week: isCustom ? null : dayOfWeek,
      custom_date: isCustom ? customDate : null,
      time_in: timeIn,
      time_out: timeOut,
      break_time: breakTime?.trim() || null,
      break_duration:
        typeof breakDuration === "number" && breakDuration >= 0 ? breakDuration : null,
    }

    const { data, error } = await adminClient
      .from("schedules")
      .insert(insertPayload)
      .select("id, user_id, day_of_week, custom_date, time_in, time_out, break_time, break_duration")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const schedule: ScheduleRow = {
      id: data.id,
      userId: data.user_id,
      dayOfWeek: data.day_of_week ?? null,
      customDate: data.custom_date ?? null,
      timeIn: data.time_in,
      timeOut: data.time_out,
      breakTime: data.break_time ?? null,
      breakDuration: data.break_duration ?? null,
    }

    return NextResponse.json(schedule, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create schedule" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const body = await request.json()
    const {
      timeIn,
      timeOut,
      breakTime,
      breakDuration,
      days,
      schedules: schedulesPayload,
      defaultTemplate: defaultPayload,
    } = body as {
      timeIn?: string
      timeOut?: string
      breakTime?: string | null
      breakDuration?: number | null
      days?: number[]
      schedules?: Array<{
        dayOfWeek: number
        timeIn: string
        timeOut: string
        breakTime?: string | null
        breakDuration?: number | null
      }>
      defaultTemplate?: {
        timeIn: string
        timeOut: string
        breakTime?: string | null
        breakDuration?: number | null
      }
    }

    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const adminClient = createAdminClient()
    const deleteRes = await adminClient
      .from("schedules")
      .delete()
      .eq("user_id", userId)
      .is("custom_date", null)

    if (deleteRes.error) {
      return NextResponse.json({ error: deleteRes.error.message }, { status: 500 })
    }

    if (
      defaultPayload &&
      typeof defaultPayload.timeIn === "string" &&
      typeof defaultPayload.timeOut === "string" &&
      defaultPayload.timeIn.trim() &&
      defaultPayload.timeOut.trim()
    ) {
      try {
        const def = {
          user_id: userId,
          time_in: defaultPayload.timeIn.trim(),
          time_out: defaultPayload.timeOut.trim(),
          break_time: defaultPayload.breakTime?.trim() || null,
          break_duration:
            typeof defaultPayload.breakDuration === "number" && defaultPayload.breakDuration >= 0
              ? defaultPayload.breakDuration
              : null,
        }
        await adminClient.from("user_schedule_defaults").upsert(def, {
          onConflict: "user_id",
        })
      } catch {
        // Table may not exist yet; schedules save still proceeds
      }
    }

    let insertPayload: Array<{
      user_id: string
      day_of_week: number
      custom_date: null
      time_in: string
      time_out: string
      break_time: string | null
      break_duration: number | null
    }>

    if (Array.isArray(schedulesPayload) && schedulesPayload.length > 0) {
      insertPayload = schedulesPayload
        .filter(
          (s) =>
            typeof s.dayOfWeek === "number" &&
            s.dayOfWeek >= 0 &&
            s.dayOfWeek <= 6 &&
            typeof s.timeIn === "string" &&
            typeof s.timeOut === "string" &&
            s.timeIn.trim() &&
            s.timeOut.trim()
        )
        .map((s) => ({
          user_id: userId,
          day_of_week: s.dayOfWeek,
          custom_date: null,
          time_in: s.timeIn.trim(),
          time_out: s.timeOut.trim(),
          break_time: s.breakTime?.trim() || null,
          break_duration:
            typeof s.breakDuration === "number" && s.breakDuration >= 0
              ? s.breakDuration
              : null,
        }))
    } else if (timeIn && timeOut && Array.isArray(days)) {
      const validDays = days.filter(
        (d) => typeof d === "number" && d >= 0 && d <= 6
      )
      insertPayload = validDays.map((dayOfWeek) => ({
        user_id: userId,
        day_of_week: dayOfWeek,
        custom_date: null,
        time_in: timeIn,
        time_out: timeOut,
        break_time: breakTime?.trim() || null,
        break_duration:
          typeof breakDuration === "number" && breakDuration >= 0
            ? breakDuration
            : null,
      }))
    } else {
      return NextResponse.json(
        { error: "Provide timeIn, timeOut, and days, or a schedules array" },
        { status: 400 }
      )
    }

    if (insertPayload.length === 0) {
      return NextResponse.json([])
    }

    const { data, error } = await adminClient
      .from("schedules")
      .insert(insertPayload)
      .select("id, user_id, day_of_week, custom_date, time_in, time_out, break_time, break_duration")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const savedRows: ScheduleRow[] = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      dayOfWeek: row.day_of_week ?? null,
      customDate: row.custom_date ?? null,
      timeIn: row.time_in,
      timeOut: row.time_out,
      breakTime: row.break_time ?? null,
      breakDuration: row.break_duration ?? null,
    }))

    return NextResponse.json(savedRows)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update schedules" },
      { status: 500 }
    )
  }
}
