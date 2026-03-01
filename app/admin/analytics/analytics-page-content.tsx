"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  Users,
  CalendarCheck,
  Clock,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Percent,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { PageHeader } from "@/components/admin/page-header"
import { Button, Card, Input } from "@/components/ui"

type AnalyticsData = {
  overview: {
    totalPresent: number
    totalLate: number
    totalAbsent: number
    todayPresent: number
    todayLate: number
    todayAbsent: number
    totalRecords: number
    activeUsers: number
    from: string
    to: string
  }
  approvalBreakdown: { pending: number; approved: number; denied: number }
  dailyTrend: { date: string; present: number; late: number; absent: number }[]
  perUser: {
    userId: string
    present: number
    late: number
    absent: number
    fullName: string
    userDisplayId: string
  }[]
}

const formatDate = (s: string) => {
  const d = new Date(s + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const formatShortDate = (s: string) => {
  const d = new Date(s + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const getDefaultRange = () => {
  const now = new Date()
  const to = now.toISOString().split("T")[0] ?? ""
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] ?? ""
  return { from, to }
}

const DATE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const

const CHART_COLORS = {
  present: "#10b981",
  late: "#f59e0b",
  absent: "#ef4444",
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
        {formatShortDate(label)}
      </p>
      <div className="space-y-1 text-sm">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="text-zinc-600 dark:text-zinc-400 capitalize">{entry.name}:</span>
            <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const AnalyticsPageContent = () => {
  const { from: defaultFrom, to: defaultTo } = getDefaultRange()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [employeePage, setEmployeePage] = useState(1)

  const EMPLOYEES_PER_PAGE = 10

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const fromParam = from.trim() || getDefaultRange().from
      const toParam = to.trim() || getDefaultRange().to
      const res = await fetch(`/api/analytics?from=${fromParam}&to=${toParam}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setEmployeePage(1)
  }, [from, to])

  useEffect(() => {
    const totalPages = Math.ceil((data?.perUser?.length ?? 0) / EMPLOYEES_PER_PAGE)
    if (totalPages > 0 && employeePage > totalPages) {
      setEmployeePage(totalPages)
    }
  }, [data?.perUser?.length, employeePage])

  const handlePreset = (days: number) => {
    const now = new Date()
    const toStr = now.toISOString().split("T")[0] ?? ""
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const fromStr = fromDate.toISOString().split("T")[0] ?? ""
    setFrom(fromStr)
    setTo(toStr)
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Attendance insights and trends" />
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-400" aria-hidden />
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading analytics…</p>
        </div>
      </div>
    )
  }

  const overview = data?.overview
  const approvalBreakdown = data?.approvalBreakdown ?? { pending: 0, approved: 0, denied: 0 }
  const dailyTrend = data?.dailyTrend ?? []
  const perUser = data?.perUser ?? []

  const totalRecords = overview?.totalRecords ?? 0
  const totalPresent = overview?.totalPresent ?? 0
  const totalLate = overview?.totalLate ?? 0
  const totalAbsent = overview?.totalAbsent ?? 0
  const activeUsers = overview?.activeUsers ?? 1
  const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0
  const lateRate = totalPresent > 0 ? Math.round((totalLate / (totalPresent + totalLate)) * 100) : 0

  const areaChartData = dailyTrend.map((d) => ({
    date: d.date,
    Present: d.present,
    Late: d.late,
    Absent: d.absent,
    total: d.present + d.late + d.absent,
  }))

  const barChartData = dailyTrend.map((d) => ({
    date: d.date,
    name: formatShortDate(d.date),
    present: d.present,
    late: d.late,
    absent: d.absent,
  }))

  const pieData = [
    { name: "Present", value: totalPresent, color: CHART_COLORS.present },
    { name: "Late", value: totalLate, color: CHART_COLORS.late },
    { name: "Absent", value: totalAbsent, color: CHART_COLORS.absent },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Attendance insights, trends, and performance metrics"
      />

      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date range
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
              {DATE_PRESETS.map(({ label, days }) => {
                const now = new Date()
                const toToday = (now.toISOString().split("T")[0] ?? "") === to
                const fromMatch =
                  from ===
                  new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0]
                const isActive = toToday && fromMatch
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handlePreset(days)}
                    aria-pressed={isActive}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    }`}
                  >
                    Last {label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-36"
                aria-label="From date"
              />
              <span className="text-zinc-400 dark:text-zinc-500">to</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-36"
                aria-label="To date"
              />
              <Button
                size="sm"
                onClick={() => loadData()}
                disabled={isLoading}
              >
                {isLoading ? "Loading…" : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {overview && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card variant="default" padding="md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
                  <Percent className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Attendance rate
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {attendanceRate}%
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {totalPresent}/{totalRecords} records
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="default" padding="md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500">
                  <Clock className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Late rate
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {lateRate}%
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {totalLate} of {totalPresent + totalLate} present
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="default" padding="md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
                  <CheckCircle2 className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Approved
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {approvalBreakdown.approved}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {approvalBreakdown.pending} pending
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="default" padding="md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500">
                  <Users className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Active employees
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {activeUsers}
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="default" padding="md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500">
                  <CalendarCheck className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Total records
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {totalRecords}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(overview.from)} – {formatDate(overview.to)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Attendance trend - area chart */}
            <Card variant="default" padding="md" className="lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <TrendingUp className="h-5 w-5" aria-hidden />
                Attendance trend
              </h2>
              {areaChartData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaChartData}>
                      <defs>
                        <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.present} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLORS.present} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.late} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLORS.late} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.absent} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLORS.absent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatShortDate}
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="Present"
                        stackId="1"
                        stroke={CHART_COLORS.present}
                        fill="url(#colorPresent)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Late"
                        stackId="1"
                        stroke={CHART_COLORS.late}
                        fill="url(#colorLate)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Absent"
                        stackId="1"
                        stroke={CHART_COLORS.absent}
                        fill="url(#colorAbsent)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No trend data for this period
                  </p>
                </div>
              )}
            </Card>

            {/* Status distribution - pie chart */}
            <Card variant="default" padding="md">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Status distribution
              </h2>
              {pieData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | undefined, name: string) => {
                          const numValue = value ?? 0
                          const total = pieData.reduce((s, d) => s + d.value, 0)
                          const pct = total > 0 ? Math.round((numValue / total) * 100) : 0
                          return [`${numValue} (${pct}%)`, name]
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No data for this period
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Daily breakdown - bar chart */}
          <Card variant="default" padding="md">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Daily breakdown
            </h2>
            {barChartData.length > 0 ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      className="text-xs"
                      stroke="currentColor"
                    />
                    <YAxis className="text-xs" stroke="currentColor" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill={CHART_COLORS.present} stackId="a" />
                    <Bar dataKey="late" name="Late" fill={CHART_COLORS.late} stackId="a" />
                    <Bar dataKey="absent" name="Absent" fill={CHART_COLORS.absent} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-80 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No daily data for this period
                </p>
              </div>
            )}
          </Card>

          {/* By employee */}
          {perUser.length > 0 && (
            <Card variant="default" padding="md">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                By employee
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Employee
                      </th>
                      <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Present
                      </th>
                      <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Late
                      </th>
                      <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Absent
                      </th>
                      <th className="pb-3 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.ceil(perUser.length / EMPLOYEES_PER_PAGE)
                      const page = Math.min(Math.max(1, employeePage), totalPages || 1)
                      const start = (page - 1) * EMPLOYEES_PER_PAGE
                      const paginated = perUser.slice(start, start + EMPLOYEES_PER_PAGE)
                      return paginated.map((u) => {
                      const total = u.present + u.late + u.absent
                      const rate = total > 0 ? Math.round((u.present / total) * 100) : 0
                      return (
                        <tr
                          key={u.userId}
                          className="border-b border-zinc-100 dark:border-zinc-800/80 last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {u.fullName}
                            </span>
                            {u.userDisplayId && (
                              <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                                (ID: {u.userDisplayId})
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-emerald-600 dark:text-emerald-400">
                            {u.present}
                          </td>
                          <td className="py-3 pr-4 text-amber-600 dark:text-amber-400">
                            {u.late}
                          </td>
                          <td className="py-3 pr-4 text-red-600 dark:text-red-400">
                            {u.absent}
                          </td>
                          <td className="py-3 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                            {rate}%
                          </td>
                        </tr>
                      )
                    })
                  })()}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                {(() => {
                  const totalPages = Math.ceil(perUser.length / EMPLOYEES_PER_PAGE)
                  const page = Math.min(Math.max(1, employeePage), totalPages || 1)
                  const start = (page - 1) * EMPLOYEES_PER_PAGE
                  const end = Math.min(start + EMPLOYEES_PER_PAGE, perUser.length)
                  const canPrev = page > 1
                  const canNext = page < totalPages
                  return (
                    <>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Showing {start + 1}–{end} of {perUser.length} employees
                      </p>
                      {totalPages > 1 ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
                            disabled={!canPrev}
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                          </Button>
                          <span className="min-w-[100px] text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Page {page} of {totalPages}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEmployeePage((p) => Math.min(totalPages, p + 1))}
                            disabled={!canNext}
                            aria-label="Next page"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            </Card>
          )}
        </>
      )}

      {!data && !isLoading && (
        <Card variant="default" padding="lg">
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            No analytics data available. Check your date range.
          </p>
        </Card>
      )}
    </div>
  )
}
