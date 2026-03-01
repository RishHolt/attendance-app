import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const { from: defaultFrom, to: defaultTo } = getDefaultDateRange()
    const from = fromParam || defaultFrom
    const to = toParam || defaultTo

    const supabase = await createClient()

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
      todayPresent: todayRows.filter((r) => r.status === "present").length,
      todayLate: todayRows.filter((r) => r.status === "late").length,
      todayAbsent: todayRows.filter((r) => r.status === "absent").length,
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

    const byDate = new Map<string, { present: number; late: number; absent: number }>()
    for (const r of rows) {
      const d = r.attendance_date
      const curr = byDate.get(d) ?? { present: 0, late: 0, absent: 0 }
      if (r.status === "present") curr.present++
      else if (r.status === "late") curr.late++
      else curr.absent++
      byDate.set(d, curr)
    }
    const dailyTrend = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))

    const userIds = [...new Set(rows.map((r) => r.user_id))]
    const { data: usersData } = await supabase
      .from("users")
      .select("id, user_id, full_name")
      .in("id", userIds)
    const userMap = new Map(
      (usersData ?? []).map((u) => [u.id, { user_id: u.user_id, full_name: u.full_name }])
    )

    const byUser = new Map<
      string,
      {
        userId: string
        present: number
        late: number
        absent: number
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
        fullName: u?.full_name ?? "Unknown",
        userDisplayId: u?.user_id ?? "",
      }
      if (r.status === "present") curr.present++
      else if (r.status === "late") curr.late++
      else curr.absent++
      byUser.set(key, curr)
    }
    const perUser = Array.from(byUser.values()).sort(
      (a, b) => b.late - a.late || b.absent - a.absent
    )

    return NextResponse.json({
      overview,
      approvalBreakdown,
      dailyTrend,
      perUser,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
