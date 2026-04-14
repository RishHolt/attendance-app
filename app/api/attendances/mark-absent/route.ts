import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { isFutureDate, resolveAbsentUserIds } from "@/lib/mark-absent"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    const todayISO = new Date().toISOString().split("T")[0] ?? ""
    const targetDate = dateParam?.match(/^\d{4}-\d{2}-\d{2}$/) ? dateParam : todayISO

    // Never mark absent for future dates
    if (isFutureDate(targetDate, todayISO)) {
      return NextResponse.json({ marked: 0 })
    }

    // Fetch all active users
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id")
      .eq("status", "active")

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const allActiveIds = (usersData ?? []).map((u) => u.id)
    if (allActiveIds.length === 0) {
      return NextResponse.json({ marked: 0 })
    }

    // Fetch schedules for active users on targetDate
    const dayOfWeek = new Date(targetDate + "T12:00:00").getDay()
    const { data: schedulesData, error: schedError } = await supabase
      .from("schedules")
      .select("user_id, day_of_week, custom_date, time_out")
      .in("user_id", allActiveIds)
      .or(`day_of_week.eq.${dayOfWeek},custom_date.eq.${targetDate}`)

    if (schedError) {
      return NextResponse.json({ error: schedError.message }, { status: 500 })
    }

    // Fetch existing attendance records for active users on targetDate
    const { data: existingData, error: existingError } = await supabase
      .from("attendances")
      .select("user_id")
      .in("user_id", allActiveIds)
      .eq("attendance_date", targetDate)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    // For today: only mark absent after the user's scheduled time_out has passed.
    // For past dates: no time restriction (null).
    // Schedule times are stored in Philippine time (UTC+8), so offset now accordingly.
    const now = new Date()
    const PH_OFFSET_MS = 8 * 60 * 60 * 1000
    const nowPH = new Date(now.getTime() + PH_OFFSET_MS)
    const nowTime =
      targetDate === todayISO
        ? `${String(nowPH.getUTCHours()).padStart(2, "0")}:${String(nowPH.getUTCMinutes()).padStart(2, "0")}`
        : null

    const absentIds = resolveAbsentUserIds(
      allActiveIds,
      schedulesData ?? [],
      existingData ?? [],
      targetDate,
      nowTime,
    )

    if (absentIds.length === 0) {
      return NextResponse.json({ marked: 0 })
    }

    const toInsert = absentIds.map((id) => ({
      user_id: id,
      attendance_date: targetDate,
      status: "absent",
      approval_status: "approved",
    }))

    // Upsert — ignore conflicts in case of a race condition
    const { error: insertError } = await supabase
      .from("attendances")
      .upsert(toInsert, { onConflict: "user_id,attendance_date", ignoreDuplicates: true })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ marked: absentIds.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark absent" },
      { status: 500 }
    )
  }
}
