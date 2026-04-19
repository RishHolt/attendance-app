import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth"
import { calcOjtProgress } from "@/lib/ojt-progress"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const filterUserId = searchParams.get("userId")

    let usersQuery = admin
      .from("users")
      .select("id, required_hours")
      .eq("role", "ojt")

    if (filterUserId) {
      usersQuery = usersQuery.eq("id", filterUserId)
    } else {
      usersQuery = usersQuery.eq("status", "active")
    }

    const { data: ojtUsers, error: usersError } = await usersQuery

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    if (!ojtUsers?.length) {
      return NextResponse.json([])
    }

    const userIds = ojtUsers.map((u) => u.id)

    const [{ data: attendances, error: attError }, { data: schedules, error: schedError }] =
      await Promise.all([
        admin
          .from("attendances")
          .select("user_id, attendance_date, time_in, time_out")
          .in("user_id", userIds)
          .not("time_in", "is", null)
          .not("time_out", "is", null),
        admin
          .from("schedules")
          .select("user_id, day_of_week, custom_date, time_in, time_out, break_duration")
          .in("user_id", userIds),
      ])

    if (attError) return NextResponse.json({ error: attError.message }, { status: 500 })
    if (schedError) return NextResponse.json({ error: schedError.message }, { status: 500 })

    const attByUser = new Map<string, { attendance_date: string; time_in: string | null; time_out: string | null }[]>()
    for (const a of attendances ?? []) {
      const list = attByUser.get(a.user_id) ?? []
      list.push({ attendance_date: a.attendance_date, time_in: a.time_in, time_out: a.time_out })
      attByUser.set(a.user_id, list)
    }

    const schedByUser = new Map<string, { dayOfWeek: number | null; customDate: string | null; timeIn: string; timeOut: string; breakDuration: number | null }[]>()
    for (const s of schedules ?? []) {
      const list = schedByUser.get(s.user_id) ?? []
      list.push({
        dayOfWeek: s.day_of_week as number | null,
        customDate: s.custom_date as string | null,
        timeIn: s.time_in as string,
        timeOut: s.time_out as string,
        breakDuration: s.break_duration as number | null,
      })
      schedByUser.set(s.user_id, list)
    }

    const result = ojtUsers.map((u) => {
      const rows = attByUser.get(u.id) ?? []
      const userSchedules = schedByUser.get(u.id) ?? []
      const progress = calcOjtProgress(rows, userSchedules, u.required_hours ?? null)
      return { userId: u.id, ...progress }
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch OJT progress" },
      { status: 500 }
    )
  }
}
