import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth"
import { isFutureDate, resolveAbsentUserIds } from "@/lib/mark-absent"
import { PH_OFFSET_MS } from "@/lib/constants"

// Process active users in chunks to bound memory + Postgres `IN (...)` size.
// Each chunk fires 2 reads (schedules + existing) and 1 upsert against Supabase.
const BATCH_SIZE = 500

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

    // Use admin client to bypass RLS — ensures status filter is authoritative
    const admin = createAdminClient()
    const { data: usersData, error: usersError } = await admin
      .from("users")
      .select("id")
      .eq("status", "active")
      .neq("role", "admin")

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const allActiveIds = (usersData ?? []).map((u) => u.id)
    if (allActiveIds.length === 0) {
      return NextResponse.json({ marked: 0 })
    }

    // For today: only mark absent after the user's scheduled time_out has passed.
    // For past dates: no time restriction (null).
    // Schedule times are stored in Philippine time (UTC+8), so offset now accordingly.
    const now = new Date()
    const nowPH = new Date(now.getTime() + PH_OFFSET_MS)
    const nowTime =
      targetDate === todayISO
        ? `${String(nowPH.getUTCHours()).padStart(2, "0")}:${String(nowPH.getUTCMinutes()).padStart(2, "0")}`
        : null

    const dayOfWeek = new Date(targetDate + "T12:00:00").getDay()
    let totalMarked = 0

    for (let i = 0; i < allActiveIds.length; i += BATCH_SIZE) {
      const chunk = allActiveIds.slice(i, i + BATCH_SIZE)

      const [schedRes, existingRes] = await Promise.all([
        admin
          .from("schedules")
          .select("user_id, day_of_week, custom_date, time_out")
          .in("user_id", chunk)
          .or(`day_of_week.eq.${dayOfWeek},custom_date.eq.${targetDate}`),
        admin
          .from("attendances")
          .select("user_id")
          .in("user_id", chunk)
          .eq("attendance_date", targetDate),
      ])

      if (schedRes.error) {
        return NextResponse.json({ error: schedRes.error.message }, { status: 500 })
      }
      if (existingRes.error) {
        return NextResponse.json({ error: existingRes.error.message }, { status: 500 })
      }

      const absentIds = resolveAbsentUserIds(
        chunk,
        schedRes.data ?? [],
        existingRes.data ?? [],
        targetDate,
        nowTime,
      )

      if (absentIds.length === 0) continue

      const toInsert = absentIds.map((id) => ({
        user_id: id,
        attendance_date: targetDate,
        status: "absent",
        approval_status: "approved",
      }))

      const { error: insertError } = await admin
        .from("attendances")
        .upsert(toInsert, { onConflict: "user_id,attendance_date", ignoreDuplicates: true })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      totalMarked += absentIds.length
    }

    return NextResponse.json({ marked: totalMarked })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark absent" },
      { status: 500 }
    )
  }
}
