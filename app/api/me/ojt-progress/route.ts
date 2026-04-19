import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calcOjtProgress } from "@/lib/ojt-progress"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, role, required_hours")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (userRow.role !== "ojt") {
      return NextResponse.json({ error: "Not an OJT user" }, { status: 400 })
    }

    const [{ data: attendances }, { data: schedules }] = await Promise.all([
      supabase
        .from("attendances")
        .select("attendance_date, time_in, time_out")
        .eq("user_id", userRow.id)
        .not("time_in", "is", null)
        .not("time_out", "is", null),
      supabase
        .from("schedules")
        .select("day_of_week, custom_date, time_in, time_out, break_duration")
        .eq("user_id", userRow.id),
    ])

    const scheduleRows = (schedules ?? []).map((s) => ({
      dayOfWeek: s.day_of_week as number | null,
      customDate: s.custom_date as string | null,
      timeIn: s.time_in as string,
      timeOut: s.time_out as string,
      breakDuration: s.break_duration as number | null,
    }))

    const progress = calcOjtProgress(
      attendances ?? [],
      scheduleRows,
      (userRow.required_hours as number | null) ?? null
    )

    return NextResponse.json(progress)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch OJT progress" },
      { status: 500 }
    )
  }
}
