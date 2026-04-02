"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
} from "lucide-react"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { PageSection } from "@/components/user/page-section"
import { formatTime12 } from "@/lib/format-time"
import { calcWorkMinutes, isLate } from "@/lib/time-calc"

type MeUser = {
  id: string
  fullName: string
  email: string
  position?: string | null
}

type AttendanceRow = {
  id: string
  date: string
  status: string
  correctionStatus?: string | null
  timeIn: string | null
  timeOut: string | null
}

type ScheduleRow = {
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakDuration?: number | null
}

type DisplayStatus = "present" | "late" | "absent" | "incomplete" | "pending"

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

const getTodayISO = () =>
  new Date().toISOString().split("T")[0] ?? ""

const getThisMonthRange = () => {
  const now = new Date()
  const to = now.toISOString().split("T")[0] ?? ""
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const year = firstOfMonth.getFullYear()
  const month = String(firstOfMonth.getMonth() + 1).padStart(2, "0")
  const day = String(firstOfMonth.getDate()).padStart(2, "0")
  const from = `${year}-${month}-${day}`
  return { from, to }
}

const getScheduleForDate = (
  dateStr: string,
  schedules: ScheduleRow[]
): ScheduleRow | null => {
  const date = new Date(dateStr + "T00:00:00")
  if (Number.isNaN(date.getTime())) return null
  const dayOfWeek = date.getDay()
  return (
    schedules.find((s) => s.customDate === dateStr) ??
    schedules.find((s) => s.customDate == null && s.dayOfWeek === dayOfWeek) ??
    null
  )
}

const computeDisplayStatus = (
  row: AttendanceRow,
  schedules: ScheduleRow[]
): DisplayStatus => {
  if (row.correctionStatus === "pending") return "pending"
  if (row.status === "absent") return "absent"
  if (row.status === "late") return "late"
  if (row.status === "incomplete") return "incomplete"
  if (!row.timeIn || schedules.length === 0) {
    return row.status === "present" ? "present" : "absent"
  }
  const schedule = getScheduleForDate(row.date, schedules)
  if (!schedule) return row.status === "present" ? "present" : "absent"
  return isLate(row.timeIn, schedule.timeIn) ? "late" : "present"
}

const formatTotalHours = (row: AttendanceRow, schedules: ScheduleRow[]): string => {
  if (!row.timeIn || !row.timeOut) return "—"
  const schedule = getScheduleForDate(row.date, schedules)
  const breakHours = schedule?.breakDuration ?? 0
  const workMinutes = calcWorkMinutes(row.timeIn, row.timeOut, breakHours)
  const actualHours = Math.round((workMinutes / 60) * 10) / 10
  if (!schedule) return String(actualHours)
  const scheduledMinutes = calcWorkMinutes(
    schedule.timeIn,
    schedule.timeOut,
    breakHours
  )
  const overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes)
  const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10
  if (overtimeHours <= 0) return String(actualHours)
  const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10
  return `${scheduledHours} (+${overtimeHours})`
}

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00")
  const today = getTodayISO()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export const DashboardPageContent = () => {
  const [me, setMe] = useState<MeUser | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow | null>(null)
  const [monthRows, setMonthRows] = useState<AttendanceRow[]>([])
  const [monthStats, setMonthStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    incomplete: 0,
  })
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [todaySchedule, setTodaySchedule] = useState<ScheduleRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const meRes = await fetch("/api/me")
      if (!meRes.ok) {
        const data = await meRes.json().catch(() => ({}))
        setLoadError(data.error ?? "Failed to load")
        setMe(null)
        return
      }
      const meData = await meRes.json()
      setMe(meData)
      const userId = meData.id
      const today = getTodayISO()
      const { from, to } = getThisMonthRange()

      const [attTodayRes, attMonthRes, schedRes] = await Promise.all([
        fetch(`/api/users/${userId}/attendances?from=${today}&to=${today}`),
        fetch(`/api/users/${userId}/attendances?from=${from}&to=${to}&page=1&limit=31`),
        fetch(`/api/users/${userId}/schedules`),
      ])

      let scheduleRows: ScheduleRow[] = []
      if (schedRes.ok) {
        const schedData = await schedRes.json()
        scheduleRows = (schedData.rows ?? []) as ScheduleRow[]
        setSchedules(scheduleRows)

        const dayOfWeek = new Date().getDay()
        const todayStr = getTodayISO()
        const customMatch = scheduleRows.find((r) => r.customDate === todayStr)
        const recurringMatch = scheduleRows.find(
          (r) => r.customDate == null && r.dayOfWeek === dayOfWeek
        )
        setTodaySchedule(customMatch ?? recurringMatch ?? null)
      }

      if (attTodayRes.ok) {
        const data = await attTodayRes.json()
        const arr = (data?.rows ?? []) as AttendanceRow[]
        setTodayAttendance(arr.length > 0 ? arr[0] : null)
      } else {
        setTodayAttendance(null)
      }

      if (attMonthRes.ok) {
        const data = await attMonthRes.json()
        const rows = (data?.rows ?? []) as AttendanceRow[]
        setMonthRows(rows)
        const stats = rows.reduce(
          (acc, row) => {
            const status = computeDisplayStatus(row, scheduleRows)
            if (status === "pending") return acc
            if (status === "present") acc.present += 1
            else if (status === "late") acc.late += 1
            else if (status === "incomplete") acc.incomplete += 1
            else acc.absent += 1
            return acc
          },
          { present: 0, late: 0, absent: 0, incomplete: 0 }
        )
        setMonthStats(stats)
      } else {
        setMonthRows([])
        setMonthStats({ present: 0, late: 0, absent: 0, incomplete: 0 })
      }
    } catch {
      setLoadError("Failed to load dashboard")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const actionLinkClass =
    "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"

  if (loadError) {
    return (
      <UserPageLayout title="Dashboard" description="Welcome back.">
        <PageSection>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={fetchData}
              className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        </PageSection>
      </UserPageLayout>
    )
  }

  if (isLoading) {
    return (
      <UserPageLayout title="Dashboard" description="Welcome back.">
        <div className="space-y-8">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700"
              />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </UserPageLayout>
    )
  }

  const firstName = me?.fullName?.split(" ")[0] ?? "there"
  const pendingCorrections = monthRows.filter(
    (r) => r.correctionStatus === "pending"
  ).length

  return (
    <UserPageLayout
      title="Dashboard"
      description={`${getGreeting()}, ${firstName}. Here's your attendance overview.`}
    >
      <div className="space-y-8">
        {/* Today's status */}
        <PageSection title="Today's status">
          {todaySchedule ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
                    todayAttendance?.timeIn
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : "bg-amber-100 dark:bg-amber-900/40"
                  }`}
                >
                  {todayAttendance?.timeIn ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {todayAttendance?.timeIn
                      ? todayAttendance.timeOut
                        ? "Clocked out"
                        : "Clocked in"
                      : "Not clocked in yet"}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {todayAttendance?.timeIn ? (
                      <>
                        In: {formatTime12(todayAttendance.timeIn)}
                        {todayAttendance.timeOut && (
                          <> · Out: {formatTime12(todayAttendance.timeOut)}</>
                        )}
                      </>
                    ) : (
                      <>Scheduled: {formatTime12(todaySchedule.timeIn)} – {formatTime12(todaySchedule.timeOut)}</>
                    )}
                  </p>
                </div>
              </div>
              <Link href="/user/attendance" className={actionLinkClass}>
                <CalendarCheck className="h-5 w-5" aria-hidden />
                {todayAttendance?.timeIn && !todayAttendance.timeOut
                  ? "Time out"
                  : "View attendance"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <CalendarRange className="h-7 w-7 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  No schedule for today
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  You don't have a work schedule assigned for today. Contact your admin if this is unexpected.
                </p>
              </div>
            </div>
          )}
        </PageSection>

        {/* Month summary stats */}
        <PageSection title="This month">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle2}
              label="Present"
              value={monthStats.present}
              colorClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
            <StatCard
              icon={AlertCircle}
              label="Late"
              value={monthStats.late}
              colorClass="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            />
            <StatCard
              icon={XCircle}
              label="Absent"
              value={monthStats.absent}
              colorClass="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            />
            <StatCard
              icon={Clock}
              label="Incomplete"
              value={monthStats.incomplete}
              colorClass="bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
            />
          </div>
          {pendingCorrections > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {pendingCorrections} correction request{pendingCorrections !== 1 ? "s" : ""} pending approval
              </p>
              <Link
                href="/user/attendance"
                className="mt-1 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                View attendance →
              </Link>
            </div>
          )}
        </PageSection>

        {/* Recent attendance */}
        <PageSection title="Recent attendance">
          {monthRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No attendance records this month yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time in
                    </th>
                    <th className="pb-3 pr-4 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time out
                    </th>
                    <th className="pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.slice(0, 5).map((row) => {
                    const displayStatus = computeDisplayStatus(row, schedules)
                    const statusClass =
                      displayStatus === "pending"
                        ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        : displayStatus === "present"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : displayStatus === "late"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : displayStatus === "incomplete"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
                      >
                        <td className="py-3 pr-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDateShort(row.date)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass}`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeIn ? formatTime12(row.timeIn) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeOut ? formatTime12(row.timeOut) : "—"}
                        </td>
                        <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatTotalHours(row, schedules)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {monthRows.length > 0 && (
            <Link
              href="/user/attendance"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View all attendance
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </PageSection>

        {/* Quick actions */}
        <PageSection title="Quick actions">
          <div className="flex flex-wrap gap-4">
            <Link href="/user/attendance" className={actionLinkClass}>
              <CalendarCheck className="h-5 w-5" aria-hidden />
              Time in / out
            </Link>
            <Link href="/user/calendar" className={actionLinkClass}>
              <CalendarDays className="h-5 w-5" aria-hidden />
              View calendar
            </Link>
            <Link href="/user/schedule" className={actionLinkClass}>
              <CalendarRange className="h-5 w-5" aria-hidden />
              My schedule
            </Link>
          </div>
        </PageSection>
      </div>
    </UserPageLayout>
  )
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  colorClass: string
}) => (
  <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
    <div className="flex items-center gap-3">
      <div className={`rounded-lg p-2 ${colorClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {value}
        </p>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      </div>
    </div>
  </div>
)
