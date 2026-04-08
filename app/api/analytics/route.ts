import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { getDefaultDateRange } from "@/lib/date-utils"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
    const from = fromParam || defaultFrom
    const to = toParam || defaultTo

    const { data: attendances, error: attError } = await supabase
      .from("attendances")
      .select("user_id, attendance_date, status, approval_status")
      .gte("attendance_date", from)
      .lte("attendance_date", to)

    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 500 })
    }

    const rows = attendances ?? []

    const todayStr = new Date().toISOString().split("T")[0]
    const todayRows = rows.filter((r) => r.attendance_date === todayStr)

    const { count: activeUsersCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")

    const overview = {
      totalPresent: rows.filter((r) => r.status === "present").length,
      totalLate: rows.filter((r) => r.status === "late").length,
      totalAbsent: rows.filter((r) => r.status === "absent").length,
      totalIncomplete: rows.filter((r) => r.status === "incomplete").length,
      todayPresent: todayRows.filter((r) => r.status === "present").length,
      todayLate: todayRows.filter((r) => r.status === "late").length,
      todayAbsent: todayRows.filter((r) => r.status === "absent").length,
      todayIncomplete: todayRows.filter((r) => r.status === "incomplete").length,
      totalRecords: rows.length,
      activeUsers: activeUsersCount ?? 0,
      from,
      to,
    }

    const approvalBreakdown = {
      pending: rows.filter((r) => (r.approval_status ?? "pending") === "pending").length,
      approved: rows.filter((r) => r.approval_status === "approved").length,
      denied: rows.filter((r) => r.approval_status === "denied").length,
    }

    const userIds = [...new Set(rows.map((r) => r.user_id))]
    const { data: usersData } = await supabase
      .from("users")
      .select("id, user_id, full_name")
      .in("id", userIds)
    const userMap = new Map(
      (usersData ?? []).map((u) => [u.id, { user_id: u.user_id, full_name: u.full_name }])
    )

    const byDate = new Map<string, { present: number; late: number; absent: number; incomplete: number }>()
    const byDateUsers = new Map<
      string,
      {
        present: { fullName: string; userDisplayId: string }[]
        late: { fullName: string; userDisplayId: string }[]
        absent: { fullName: string; userDisplayId: string }[]
        incomplete: { fullName: string; userDisplayId: string }[]
      }
    >()
    for (const r of rows) {
      const d = r.attendance_date
      const curr = byDate.get(d) ?? { present: 0, late: 0, absent: 0, incomplete: 0 }
      if (r.status === "present") curr.present++
      else if (r.status === "late") curr.late++
      else if (r.status === "absent") curr.absent++
      else if (r.status === "incomplete") curr.incomplete++
      byDate.set(d, curr)

      const u = userMap.get(r.user_id)
      const userEntry = { fullName: u?.full_name ?? "Unknown", userDisplayId: u?.user_id ?? "" }
      const dayUsers = byDateUsers.get(d) ?? {
        present: [],
        late: [],
        absent: [],
        incomplete: [],
      }
      if (r.status === "present") dayUsers.present.push(userEntry)
      else if (r.status === "late") dayUsers.late.push(userEntry)
      else if (r.status === "absent") dayUsers.absent.push(userEntry)
      else if (r.status === "incomplete") dayUsers.incomplete.push(userEntry)
      byDateUsers.set(d, dayUsers)
    }
    const dailyTrend = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))
    const dailyBreakdown = Array.from(byDateUsers.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, ...users }))

    const byUser = new Map<
      string,
      {
        userId: string
        present: number
        late: number
        absent: number
        incomplete: number
        fullName: string
        userDisplayId: string
      }
    >()
    for (const r of rows) {
      const u = userMap.get(r.user_id)
      const key = r.user_id
      const curr = byUser.get(key) ?? {
        userId: r.user_id,
        present: 0,
        late: 0,
        absent: 0,
        incomplete: 0,
        fullName: u?.full_name ?? "Unknown",
        userDisplayId: u?.user_id ?? "",
      }
      if (r.status === "present") curr.present++
      else if (r.status === "late") curr.late++
      else if (r.status === "absent") curr.absent++
      else if (r.status === "incomplete") curr.incomplete++
      byUser.set(key, curr)
    }
    const perUser = Array.from(byUser.values()).sort(
      (a, b) => b.late - a.late || b.absent - a.absent
    )

    return NextResponse.json({
      overview,
      approvalBreakdown,
      dailyTrend,
      dailyBreakdown,
      perUser,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
