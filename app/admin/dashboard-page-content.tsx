"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  CalendarCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  QrCode,
  BarChart3,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  TrendingUp,
  Percent,
} from "lucide-react"
import { Button, Card } from "@/components/ui"
import { PageHeader } from "@/components/admin/page-header"
import { DenyAttendanceModal } from "./attendance/deny-attendance-modal"
import { QrAttendanceModal } from "./attendance/qr-attendance-modal"
import { formatTime12 } from "@/lib/format-time"
import { getWeekDateRange } from "@/lib/date-utils"
import { swal } from "@/lib/swal"
import type { AdminAttendanceRow } from "@/types"

type Overview = {
  todayPresent: number
  todayLate: number
  todayAbsent: number
  todayIncomplete: number
  activeUsers: number
  totalPresent: number
  totalLate: number
  totalAbsent: number
  totalIncomplete: number
  totalRecords: number
  from: string
  to: string
}

type DayBreakdown = {
  date: string
  present: { fullName: string; userDisplayId: string }[]
  late: { fullName: string; userDisplayId: string }[]
  absent: { fullName: string; userDisplayId: string }[]
}

type AnalyticsData = {
  overview: Overview
  approvalBreakdown: { pending: number; approved: number; denied: number }
  dailyTrend: { date: string; present: number; late: number; absent: number }[]
  dailyBreakdown?: DayBreakdown[]
  perUser: {
    userId: string
    present: number
    late: number
    absent: number
    fullName: string
    userDisplayId: string
  }[]
}

type ScheduleSummary = {
  userId: string
  hasSchedule: boolean
  summary: string
}

const getTodayISO = () => new Date().toISOString().split("T")[0] ?? ""

const formatAnalyticsDate = (s: string) => {
  const d = new Date(s + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const secondaryLinkClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"

export const DashboardPageContent = () => {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [pendingAttendances, setPendingAttendances] = useState<AdminAttendanceRow[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [todayAttendances, setTodayAttendances] = useState<AdminAttendanceRow[]>([])
  const [noScheduleUsers, setNoScheduleUsers] = useState<
    { id: string; fullName: string; email?: string; position?: string; userId?: string }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyModalRow, setDenyModalRow] = useState<AdminAttendanceRow | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [whoByDayTab, setWhoByDayTab] = useState<"present" | "absent">("present")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const today = getTodayISO()
    const { from: weekFrom, to: weekTo } = getWeekDateRange()

    // Auto-mark absent for today before loading analytics
    await fetch(`/api/attendances/mark-absent?date=${today}`, { method: "POST" }).catch(() => {})

    try {
      const [analyticsRes, pendingRes, todayRes, summariesRes, usersRes] = await Promise.all([
        fetch(`/api/analytics?from=${weekFrom}&to=${weekTo}`),
        fetch(`/api/attendances?approval_status=pending&page=1&limit=5`),
        fetch(`/api/attendances?from=${today}&to=${today}&limit=20`),
        fetch("/api/schedules/summaries"),
        fetch("/api/users"),
      ])

      if (analyticsRes.ok) {
        const json = await analyticsRes.json()
        setOverview(json.overview)
        setAnalyticsData(json)
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        const rows = data.rows ?? []
        setPendingAttendances(rows.filter((r: AdminAttendanceRow) => r.approvalStatus === "pending"))
        setPendingTotal(data.total ?? 0)
      }

      if (todayRes.ok) {
        const data = await todayRes.json()
        setTodayAttendances(data.rows ?? [])
      }

      if (summariesRes.ok && usersRes.ok) {
        const summaries: ScheduleSummary[] = await summariesRes.json()
        const users: { id: string; fullName: string; email?: string; position?: string; userId?: string }[] =
          await usersRes.json()
        const noSchedule = summaries
          .filter((s) => !s.hasSchedule)
          .map((s) => {
            const u = users.find((usr: { id: string }) => usr.id === s.userId)
            return {
              id: s.userId,
              fullName: u?.fullName ?? "Unknown",
              email: u?.email,
              position: u?.position,
              userId: u?.userId,
            }
          })
        setNoScheduleUsers(noSchedule)
      }
    } catch {
      setOverview(null)
      setAnalyticsData(null)
      setPendingAttendances([])
      setTodayAttendances([])
      setNoScheduleUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleApprove = async (row: AdminAttendanceRow) => {
    setApprovingId(row.id)
    try {
      const res = await fetch(
        `/api/users/${row.userId}/attendances/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "approved" }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to approve")
        return
      }
      await swal.success("Attendance approved")
      loadData()
    } catch {
      swal.error("Failed to approve")
    } finally {
      setApprovingId(null)
    }
  }

  const handleDenyClick = (row: AdminAttendanceRow) => setDenyModalRow(row)

  const handleDenyConfirm = async (remarks: string) => {
    if (!denyModalRow) return
    setDenyingId(denyModalRow.id)
    try {
      const res = await fetch(
        `/api/users/${denyModalRow.userId}/attendances/${denyModalRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "denied", remarks: remarks || null }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to deny")
        return
      }
      await swal.success("Attendance denied")
      setDenyModalRow(null)
      loadData()
    } catch {
      swal.error("Failed to deny")
    } finally {
      setDenyingId(null)
    }
  }

  const pendingRows = pendingAttendances.slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of attendance, pending approvals, and action items"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              leftIcon={<QrCode className="h-4 w-4" />}
              onClick={() => setQrModalOpen(true)}
              aria-label="Show QR attendance code"
            >
              QR Attendance
            </Button>
            <Link href="/admin/analytics" className={secondaryLinkClass}>
              <BarChart3 className="h-4 w-4" aria-hidden />
              View analytics
            </Link>
          </div>
        }
      />

      <QrAttendanceModal open={qrModalOpen} onClose={() => setQrModalOpen(false)} />
      <DenyAttendanceModal
        open={!!denyModalRow}
        onClose={() => setDenyModalRow(null)}
        row={denyModalRow}
        onDeny={handleDenyConfirm}
        isDenying={!!denyingId}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <Clock className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Pending</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : pendingTotal}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
            <CheckCircle2 className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">This week present</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : overview?.totalPresent ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <Clock className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">This week late</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : overview?.totalLate ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500">
            <AlertCircle className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">This week absent</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : overview?.totalAbsent ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500">
            <CalendarRange className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Incomplete today</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : overview?.todayIncomplete ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500">
            <Users className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : overview?.activeUsers ?? 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500">
            <AlertTriangle className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">No schedule</p>
            <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {isLoading ? "—" : noScheduleUsers.length}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Analytics (last 30 days)
          </h2>
          <Link href="/admin/analytics" className={secondaryLinkClass}>
            <BarChart3 className="h-4 w-4" aria-hidden />
            View full analytics
          </Link>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading analytics…</p>
            </div>
          ) : !analyticsData ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <BarChart3 className="h-7 w-7 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-100">
                No analytics data
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Analytics will appear once attendance records exist.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {(() => {
                  const totalRecords = analyticsData.overview.totalRecords || 0
                  const totalPresent = analyticsData.overview.totalPresent
                  const totalLate = analyticsData.overview.totalLate
                  const attendanceRate =
                    totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0
                  const lateRate =
                    totalPresent + totalLate > 0
                      ? Math.round((totalLate / (totalPresent + totalLate)) * 100)
                      : 0
                  return (
                    <>
                      <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
                          <Percent className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Attendance rate
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {attendanceRate}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500">
                          <Clock className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Late rate
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {lateRate}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/90">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500">
                          <CheckCircle2 className="h-5 w-5 text-white" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Approved (30d)
                          </p>
                          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {analyticsData.approvalBreakdown.approved}
                          </p>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>

              {analyticsData.dailyTrend.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    <TrendingUp className="h-4 w-4" aria-hidden />
                    Daily trend (last 7 days)
                  </h3>
                  <div className="space-y-2">
                    {analyticsData.dailyTrend.slice(-7).map((day) => {
                      const total = day.present + day.late + day.absent
                      const maxDaily = Math.max(
                        ...analyticsData.dailyTrend.slice(-7).map((d) => d.present + d.late + d.absent),
                        1
                      )
                      const pct = total > 0 ? (total / maxDaily) * 100 : 0
                      return (
                        <div key={day.date} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                            {formatAnalyticsDate(day.date)}
                          </span>
                          <div className="flex min-w-0 flex-1 items-center gap-0.5">
                            {day.present > 0 && (
                              <div
                                className="h-5 rounded-l bg-emerald-500"
                                style={{
                                  width: `${total > 0 ? (day.present / total) * pct : 0}%`,
                                  minWidth: day.present ? 4 : 0,
                                }}
                              />
                            )}
                            {day.late > 0 && (
                              <div
                                className="h-5 bg-amber-500"
                                style={{
                                  width: `${total > 0 ? (day.late / total) * pct : 0}%`,
                                  minWidth: day.late ? 4 : 0,
                                }}
                              />
                            )}
                            {day.absent > 0 && (
                              <div
                                className="h-5 rounded-r bg-red-500"
                                style={{
                                  width: `${total > 0 ? (day.absent / total) * pct : 0}%`,
                                  minWidth: day.absent ? 4 : 0,
                                }}
                              />
                            )}
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                            {total}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {analyticsData.dailyBreakdown && analyticsData.dailyBreakdown.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    Who is in by day (last 7 days)
                  </h3>
                  <div
                    className="mb-4 flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1.5 dark:border-zinc-700 dark:bg-zinc-800/80"
                    role="tablist"
                    aria-label="Filter by status"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={whoByDayTab === "present"}
                      onClick={() => setWhoByDayTab("present")}
                      className={`min-h-[44px] flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        whoByDayTab === "present"
                          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                          : "text-zinc-600 hover:bg-white/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={whoByDayTab === "absent"}
                      onClick={() => setWhoByDayTab("absent")}
                      className={`min-h-[44px] flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        whoByDayTab === "absent"
                          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                          : "text-zinc-600 hover:bg-white/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {analyticsData.dailyBreakdown.slice(-7).map((day) => {
                      const presentAndLate = [...day.present, ...day.late]
                      const list = whoByDayTab === "present" ? presentAndLate : day.absent
                      return (
                        <div
                          key={day.date}
                          className="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900/90"
                        >
                          <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatDate(day.date)}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                              {list.length} {list.length === 1 ? "person" : "people"}
                            </p>
                          </div>
                          <div className="p-3">
                            {list.length === 0 ? (
                              <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                                {whoByDayTab === "present" ? "No one" : "No one absent"}
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {list.map((u, i) => (
                                  <li
                                    key={`${day.date}-${i}-${u.fullName}`}
                                    className="flex items-baseline justify-between gap-2 text-sm text-zinc-900 dark:text-zinc-100"
                                  >
                                    <span className="min-w-0 truncate font-medium">{u.fullName}</span>
                                    {u.userDisplayId ? (
                                      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                        {u.userDisplayId}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {analyticsData.perUser.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    By employee (top by late/absent)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[300px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="pb-2 pr-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Employee
                          </th>
                          <th className="pb-2 pr-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Present
                          </th>
                          <th className="pb-2 pr-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Late
                          </th>
                          <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Absent
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.perUser.slice(0, 5).map((u) => (
                          <tr key={u.userId} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                            <td className="py-2 pr-3">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.fullName}</span>
                              {u.userDisplayId && (
                                <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  (ID: {u.userDisplayId})
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-emerald-600 dark:text-emerald-400">{u.present}</td>
                            <td className="py-2 pr-3 text-amber-600 dark:text-amber-400">{u.late}</td>
                            <td className="py-2 text-red-600 dark:text-red-400">{u.absent}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Pending approval */}
      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Pending approval
          </h2>
          <Link href="/admin/attendance">
            <span className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              View all →
            </span>
          </Link>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            </div>
          ) : pendingRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <CheckCircle2 className="h-7 w-7 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-100">
                No pending attendances
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                All attendance records are up to date.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Employee</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time In</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time Out</th>
                    <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                      <td className="py-4 pr-4 text-sm text-zinc-900 dark:text-zinc-100">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.fullName}</p>
                          {row.userDisplayId && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">ID: {row.userDisplayId}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.status === "present"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : row.status === "late"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {row.timeIn ? formatTime12(row.timeIn) : "—"}
                      </td>
                      <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {row.timeOut ? formatTime12(row.timeOut) : "—"}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {row.timeOut ? (
                            <Button
                              size="sm"
                              leftIcon={<CheckCircle2 className="h-4 w-4" />}
                              onClick={() => handleApprove(row)}
                              disabled={approvingId === row.id || denyingId === row.id}
                              isLoading={approvingId === row.id}
                            >
                              Approve
                            </Button>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">Awaiting time out</span>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<XCircle className="h-4 w-4" />}
                            onClick={() => handleDenyClick(row)}
                            disabled={approvingId === row.id || denyingId === row.id}
                            isLoading={denyingId === row.id}
                          >
                            Deny
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Today's attendance */}
      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Today&apos;s attendance
          </h2>
          <Link href="/admin/calendar">
            <span className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              View calendar →
            </span>
          </Link>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            </div>
          ) : todayAttendances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <CalendarCheck className="h-7 w-7 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-100">
                No attendance records today
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Attendance will appear here when employees time in.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Employee</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time In</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time Out</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendances.slice(0, 10).map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.fullName}</p>
                          {row.userDisplayId && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">ID: {row.userDisplayId}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            row.status === "present"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : row.status === "late"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {row.timeIn ? formatTime12(row.timeIn) : "—"}
                      </td>
                      <td className="py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {row.timeOut ? formatTime12(row.timeOut) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Users without schedule */}
      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Users without schedule
          </h2>
          <Link href="/admin/schedule">
            <span className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Manage schedules →
            </span>
          </Link>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            </div>
          ) : noScheduleUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <CalendarRange className="h-7 w-7 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-100">
                All users have schedules
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Every user has at least one day configured.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {noScheduleUsers.map((u) => (
                <Link
                  key={u.id}
                  href="/admin/schedule"
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{u.fullName}</p>
                    {u.email && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                    )}
                    {u.position && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.position}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-orange-600 dark:text-orange-400">No schedule</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Quick actions */}
      <Card variant="default" padding="md">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/users" className={secondaryLinkClass}>
            <Users className="h-4 w-4" aria-hidden />
            User management
          </Link>
          <Link href="/admin/attendance" className={secondaryLinkClass}>
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Manage attendance
          </Link>
          <Link href="/admin/calendar" className={secondaryLinkClass}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            View calendar
          </Link>
          <Link href="/admin/schedule" className={secondaryLinkClass}>
            <CalendarRange className="h-4 w-4" aria-hidden />
            Manage schedules
          </Link>
        </div>
      </Card>
    </div>
  )
}
