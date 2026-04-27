import { NextResponse } from "next/server"
import { formatTime12 } from "@/lib/format-time"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import type { ScheduleSummary } from "@/types"

export type { ScheduleSummary }

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

function formatDaysRange(days: number[]): string {
  if (days.length === 0) return ""
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 1) return DAY_LABELS[sorted[0]]
  const consecutive: number[][] = []
  let run: number[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === run[run.length - 1] + 1) {
      run.push(sorted[i])
    } else {
      consecutive.push(run)
      run = [sorted[i]]
    }
  }
  consecutive.push(run)
  return consecutive
    .map((r) =>
      r.length >= 2 ? `${DAY_LABELS[r[0]]}–${DAY_LABELS[r[r.length - 1]]}` : DAY_LABELS[r[0]]
    )
    .join(", ")
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get("page")
    const search = searchParams.get("search")?.trim() ?? ""
    const searchPattern = search.length > 0 ? `*${search}*` : null

    // Pagination is opt-in via ?page=. Without it, response shape is unchanged
    // (plain array) so existing callers don't break.
    const paginated = pageParam != null

    let usersQuery = paginated
      ? supabase
          .from("users")
          .select("id", { count: "exact" })
          .neq("role", "admin")
      : supabase
          .from("users")
          .select("id")
          .neq("role", "admin")

    if (searchPattern) {
      usersQuery = usersQuery.or(
        `full_name.ilike.${searchPattern},email.ilike.${searchPattern},user_id.ilike.${searchPattern}`
      )
    }
    usersQuery = usersQuery.order("created_at", { ascending: false })

    let total = 0
    let userIds: string[] = []
    let page = 1
    let pageSize = 50

    if (paginated) {
      page = Math.max(1, parseInt(pageParam, 10) || 1)
      pageSize = Math.min(
        200,
        Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50)
      )
      const offset = (page - 1) * pageSize
      const { data: usersData, count } = await usersQuery.range(
        offset,
        offset + pageSize - 1
      )
      userIds = (usersData ?? []).map((u) => u.id)
      total = count ?? 0
    } else {
      const { data: usersData } = await usersQuery
      userIds = (usersData ?? []).map((u) => u.id)
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        paginated ? { rows: [], total, page, pageSize } : []
      )
    }

    const { data: schedulesData } = await supabase
      .from("schedules")
      .select("user_id, day_of_week, custom_date, time_in, time_out")
      .in("user_id", userIds)

    const recurringData = (schedulesData ?? []).filter(
      (r) => r.custom_date == null && r.day_of_week != null
    )
    const customDateData = (schedulesData ?? []).filter(
      (r) => r.custom_date != null
    )

    const customDateCountByUser = new Map<string, number>()
    for (const r of customDateData) {
      customDateCountByUser.set(
        r.user_id,
        (customDateCountByUser.get(r.user_id) ?? 0) + 1
      )
    }

    const { data: defaultsData } = await supabase
      .from("user_schedule_defaults")
      .select("user_id, time_in, time_out")
      .in("user_id", userIds)

    const defaultsByUser = new Map(
      (defaultsData ?? []).map((d) => [
        d.user_id,
        { timeIn: formatTime12(d.time_in), timeOut: formatTime12(d.time_out) },
      ])
    )

    const schedulesByUser = new Map<
      string,
      { days: Set<number>; timeIn: string; timeOut: string; count: number }[]
    >()

    for (const row of recurringData) {
      const uid = row.user_id
      const day = row.day_of_week
      if (day === null) continue
      const timeIn = formatTime12(row.time_in)
      const timeOut = formatTime12(row.time_out)
      let arr = schedulesByUser.get(uid)
      if (!arr) {
        arr = []
        schedulesByUser.set(uid, arr)
      }
      const ex = arr.find((x) => x.timeIn === timeIn && x.timeOut === timeOut)
      if (ex) {
        ex.days.add(day)
        ex.count += 1
      } else {
        arr.push({
          days: new Set([day]),
          timeIn,
          timeOut,
          count: 1,
        })
      }
    }

    const result: ScheduleSummary[] = userIds.map((userId) => {
      const defaults = defaultsByUser.get(userId)
      const arr = schedulesByUser.get(userId)
      const customDateCount = customDateCountByUser.get(userId) ?? 0
      const hasRecurring = !!arr && arr.some((a) => a.days.size > 0)
      const hasSchedule = hasRecurring || customDateCount > 0

      if (!hasSchedule) {
        return { userId, hasSchedule: false, summary: "" }
      }

      const parts: string[] = []

      if (hasRecurring && arr!.length > 0) {
        const best = arr!.reduce((a, b) => {
          const aDays = a.days.size
          const bDays = b.days.size
          if (bDays > aDays) return b
          if (aDays > bDays) return a
          return b.count > a.count ? b : a
        })

        const days = [...best.days].sort((a, b) => a - b)
        const timeIn = defaults?.timeIn ?? best.timeIn
        const timeOut = defaults?.timeOut ?? best.timeOut
        const daysStr = formatDaysRange(days)
        const main = daysStr ? `${daysStr} ${timeIn}–${timeOut}` : `${timeIn}–${timeOut}`
        parts.push(main)

        const customDays = arr!.filter((x) => x !== best)
        if (customDays.length > 0) {
          const customParts = customDays.map((c) => {
            const d = formatDaysRange([...c.days].sort((a, b) => a - b))
            return d ? `${d} ${c.timeIn}–${c.timeOut}` : `${c.timeIn}–${c.timeOut}`
          })
          parts.push(customParts.join(" · "))
        }
      }

      if (customDateCount > 0) {
        parts.push(
          `${customDateCount} custom ${customDateCount === 1 ? "date" : "dates"}`
        )
      }

      const summary = parts.join(" · ")

      return { userId, hasSchedule: true, summary }
    })

    return NextResponse.json(
      paginated ? { rows: result, total, page, pageSize } : result
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch schedule summaries" },
      { status: 500 }
    )
  }
}
