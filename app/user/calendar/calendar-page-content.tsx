"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Eye, SlidersHorizontal, FilePenLine } from "lucide-react"
import { Button } from "@/components/ui"
import { CalendarGridSkeleton, Skeleton } from "@/components/ui/skeleton"
import { formatTime12 } from "@/lib/format-time"
import { calcWorkMinutes, formatMinutesAsHours, formatTotalWithOvertime } from "@/lib/time-calc"
import { deriveAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { PageSection } from "@/components/user/page-section"
import { ViewDtrModal } from "@/app/admin/calendar/view-dtr-modal"
import { buildDtrExportFileBaseName } from "@/lib/dtr/export-filename"
import { RequestCorrectionModal } from "@/app/user/attendance/request-correction-modal"
import type { ScheduleRow } from "@/types/schedule"
import { convertApiScheduleToScheduleRow } from "@/lib/schedule-utils"
type MeUser = {
  id: string
  fullName: string
  startDate: string | null
  status?: string
  role: "employee" | "admin" | "ojt"
  requiredHours: number | null
}

type OjtProgress = {
  hoursCompleted: number
  requiredHours: number | null
  percent: number | null
}

type AttendanceRow = {
  id: string
  userId?: string
  date: string
  status: string
  approvalStatus?: "pending" | "approved" | "denied"
  timeIn: string | null
  timeOut: string | null
  correctionStatus?: string | null
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const LEGENDS: { status: AttendanceStatus; label: string; color: string; bg: string; dot: string }[] = [
  { status: "present", label: "Present", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40", dot: "bg-emerald-500" },
  { status: "late", label: "Late", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", dot: "bg-amber-500" },
  { status: "absent", label: "Absent", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", dot: "bg-red-500" },
  { status: "pending", label: "Pending", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40", dot: "bg-orange-500" },
  { status: "today", label: "Today", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", dot: "bg-blue-500" },
  { status: "upcoming", label: "Upcoming", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40", dot: "bg-violet-500" },
  { status: "no-schedule", label: "No schedule", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800", dot: "bg-zinc-400" },
]

const DATE_LEGENDS: { key: string; label: string; bg: string; dot: string; ring?: string }[] = [
  { key: "prev-month", label: "Previous month", bg: "bg-zinc-200 dark:bg-zinc-700", dot: "bg-zinc-500" },
  { key: "today", label: "Today (blue outline)", bg: "bg-blue-50 dark:bg-blue-950/40", dot: "bg-blue-500", ring: "ring-2 ring-blue-500 dark:ring-blue-400" },
  { key: "upcoming", label: "Upcoming", bg: "bg-violet-100 dark:bg-violet-900/40", dot: "bg-violet-500" },
  { key: "next-month", label: "Next month", bg: "bg-zinc-100 dark:bg-zinc-800", dot: "bg-zinc-400" },
]

const fetchUserSchedules = async (userId: string): Promise<ScheduleRow[]> => {
  const res = await fetch(`/api/users/${userId}/schedules`)
  if (!res.ok) return []
  const data = await res.json()
  const rows = data.rows ?? []
  return rows
    .filter(
      (r: { dayOfWeek: number | null; customDate: string | null }) =>
        r.dayOfWeek != null || r.customDate != null
    )
    .map(convertApiScheduleToScheduleRow)
}

const PAGE_SIZE = 500

const fetchAttendances = async (
  userId: string,
  from: string,
  to: string
): Promise<AttendanceRow[]> => {
  const allRows: AttendanceRow[] = []
  let page = 1
  let total = Infinity

  while (allRows.length < total) {
    const res = await fetch(
      `/api/users/${userId}/attendances?from=${from}&to=${to}&page=${page}&limit=${PAGE_SIZE}`
    )
    if (!res.ok) return allRows.length ? allRows : []
    const data = await res.json()
    const rows = data?.rows ?? []
    if (rows.length === 0) break
    allRows.push(...rows)
    total = typeof data?.total === "number" ? data.total : allRows.length
    if (rows.length < PAGE_SIZE || allRows.length >= total) break
    page++
  }

  return allRows
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const parseIsoDateLocal = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const getCalendarVisibleRange = (currentDate: Date): { from: string; to: string } => {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const startPad = firstOfMonth.getDay()
  const daysInMonth = lastOfMonth.getDate()
  const remaining = 42 - startPad - daysInMonth
  const firstVisible = new Date(year, month, 1 - startPad)
  const lastVisible = new Date(year, month + 1, remaining)
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    from: `${firstVisible.getFullYear()}-${pad(firstVisible.getMonth() + 1)}-${pad(firstVisible.getDate())}`,
    to: `${lastVisible.getFullYear()}-${pad(lastVisible.getMonth() + 1)}-${pad(lastVisible.getDate())}`,
  }
}

const mergeAttendanceFetchRanges = (
  calendar: { from: string; to: string },
  hoursFrom: string,
  hoursTo: string
): { from: string; to: string } => {
  if (!hoursFrom || !hoursTo || hoursFrom > hoursTo) return calendar
  return {
    from: calendar.from < hoursFrom ? calendar.from : hoursFrom,
    to: calendar.to > hoursTo ? calendar.to : hoursTo,
  }
}

export const UserCalendarPageContent = () => {
  const [me, setMe] = useState<MeUser | null>(null)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewDtrModalOpen, setViewDtrModalOpen] = useState(false)
  const [correctionModalRow, setCorrectionModalRow] = useState<AttendanceRow | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [hoursRangeFrom, setHoursRangeFrom] = useState("")
  const [hoursRangeTo, setHoursRangeTo] = useState("")
  const [draftFrom, setDraftFrom] = useState("")
  const [draftTo, setDraftTo] = useState("")
  const [ojtProgress, setOjtProgress] = useState<OjtProgress | null>(null)
  const [hoursFilterOpen, setHoursFilterOpen] = useState(false)
  const hoursFilterWrapRef = useRef<HTMLDivElement>(null)

  const applyDefaultHoursRange = useCallback(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const now = new Date()
    const isViewingCurrentMonth =
      now.getFullYear() === y && now.getMonth() === m
    const defaultFrom = toDateStr(first)
    const defaultTo = isViewingCurrentMonth ? toDateStr(now) : toDateStr(last)
    setHoursRangeFrom(defaultFrom)
    setHoursRangeTo(defaultTo)
    setDraftFrom(defaultFrom)
    setDraftTo(defaultTo)
  }, [currentDate])

  useEffect(() => {
    applyDefaultHoursRange()
  }, [applyDefaultHoursRange])

  useEffect(() => {
    if (hoursFilterOpen) {
      setDraftFrom(hoursRangeFrom)
      setDraftTo(hoursRangeTo)
    }
  }, [hoursFilterOpen, hoursRangeFrom, hoursRangeTo])

  useEffect(() => {
    if (!hoursFilterOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (!hoursFilterWrapRef.current?.contains(e.target as Node)) {
        setHoursFilterOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHoursFilterOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [hoursFilterOpen])

  useEffect(() => {
    const loadMe = async () => {
      const res = await fetch("/api/me")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setLoadError(data.error ?? "Failed to load")
        setIsLoading(false)
        return
      }
      const data = await res.json()
      setMe(data)
      if (data.role === "ojt") {
        fetch("/api/me/ojt-progress")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) setOjtProgress(d) })
          .catch(() => {})
      }
    }
    loadMe()
  }, [])

  const mergedAttendanceFetchRange = useMemo(() => {
    const cal = getCalendarVisibleRange(currentDate)
    return mergeAttendanceFetchRanges(cal, hoursRangeFrom, hoursRangeTo)
  }, [currentDate, hoursRangeFrom, hoursRangeTo])

  useEffect(() => {
    if (!me?.id) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const { from, to } = mergedAttendanceFetchRange
      const [schedData, attData] = await Promise.all([
        fetchUserSchedules(me.id),
        fetchAttendances(me.id, from, to),
      ])
      if (!cancelled) {
        setSchedules(schedData)
        setAttendances(attData)
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [me?.id, mergedAttendanceFetchRange, refreshTrigger])

  const scheduleByDay = useMemo(() => {
    const map = new Map<number, ScheduleRow>()
    for (const s of schedules) {
      if (s.dayOfWeek != null) map.set(s.dayOfWeek, s)
    }
    return map
  }, [schedules])

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduleRow>()
    for (const s of schedules) {
      if (s.customDate) {
        const key = String(s.customDate).slice(0, 10)
        map.set(key, s)
      }
    }
    return map
  }, [schedules])

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>()
    for (const a of attendances) {
      const key =
        typeof a.date === "string" ? a.date.slice(0, 10) : String(a.date).slice(0, 10)
      map.set(key, a)
    }
    return map
  }, [attendances])

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const daysInMonth = last.getDate()

    const days: { date: Date; isCurrentMonth: boolean; isNextMonth: boolean; isPrevMonth: boolean }[] = []

    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, 1 - (startPad - i))
      days.push({ date: d, isCurrentMonth: false, isNextMonth: false, isPrevMonth: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true, isNextMonth: false, isPrevMonth: false })
    }
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isNextMonth: true,
        isPrevMonth: false,
      })
    }
    return days
  }, [currentDate])

  const monthLabel = useMemo(
    () =>
      currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [currentDate]
  )

  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  }

  const canRequestCorrection = (
    row: AttendanceRow,
    displayedStatus: string
  ) =>
    (displayedStatus === "incomplete" ||
      displayedStatus === "late" ||
      displayedStatus === "absent" ||
      row.approvalStatus === "denied") &&
    row.correctionStatus !== "pending"

  const handleCorrectionSuccess = useCallback(() => {
    setCorrectionModalRow(null)
    setRefreshTrigger((t) => t + 1)
  }, [])

  const todayKey = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  }, [])

  const todayIso = toDateStr(new Date())

  const handleDraftFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (!v) return
    setDraftFrom(v)
    if (draftTo && draftTo < v) setDraftTo(v)
  }

  const handleDraftToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (!v) return
    setDraftTo(v)
    if (draftFrom && draftFrom > v) setDraftFrom(v)
  }

  const totalRegularMinutes = useMemo(() => {
    if (!hoursRangeFrom || !hoursRangeTo) return 0
    if (hoursRangeFrom > hoursRangeTo) return 0
    let sum = 0
    let d = parseIsoDateLocal(hoursRangeFrom)
    const end = parseIsoDateLocal(hoursRangeTo)
    while (d.getTime() <= end.getTime()) {
      const dateStr = toDateStr(d)
      const dayOfWeek = d.getDay()
      const schedule =
        scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
      const existingAttendance = attendanceByDate.get(dateStr)
      if (
        schedule &&
        existingAttendance?.timeIn &&
        existingAttendance?.timeOut
      ) {
        const actualM = calcWorkMinutes(
          existingAttendance.timeIn,
          existingAttendance.timeOut,
          schedule.breakDuration ?? 0
        )
        const scheduledM = calcWorkMinutes(
          schedule.timeIn,
          schedule.timeOut,
          schedule.breakDuration ?? 0
        )
        sum += Math.min(actualM, scheduledM)
      }
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    }
    return sum
  }, [
    hoursRangeFrom,
    hoursRangeTo,
    scheduleByDay,
    scheduleByDate,
    attendanceByDate,
  ])

  if (isLoading && !me) {
    return (
      <UserPageLayout
        title="Calendar"
        description="View your attendance calendar"
      >
        <PageSection>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          </div>
        </PageSection>
      </UserPageLayout>
    )
  }

  if (loadError || !me) {
    return (
      <UserPageLayout
        title="Calendar"
        description="View your attendance calendar"
      >
        <PageSection>
          <p className="text-red-600 dark:text-red-400" role="alert">
            {loadError ?? "Unable to load calendar"}
          </p>
        </PageSection>
      </UserPageLayout>
    )
  }

  return (
    <UserPageLayout
      title="Calendar"
      description="View your attendance calendar"
    >
      <div className="min-w-0 space-y-6 sm:space-y-8">
        <PageSection padding="sm" aria-busy={isLoading}>
          {isLoading && (
            <span className="sr-only">Loading calendar data</span>
          )}
          {me?.role === "ojt" && ojtProgress && (
            <div className="mb-4 rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-4 dark:border-violet-700/50 dark:bg-violet-950/20">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Required Time Progress
              </p>
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {ojtProgress.hoursCompleted}
                  </span>
                  {ojtProgress.requiredHours != null ? (
                    <> / {ojtProgress.requiredHours} hrs</>
                  ) : " hrs completed"}
                </p>
                {ojtProgress.percent != null && (
                  <span className="text-lg font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                    {ojtProgress.percent}%
                  </span>
                )}
              </div>
              {ojtProgress.percent != null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-violet-200 dark:bg-violet-900/40">
                  <div
                    className="relative h-2 overflow-hidden rounded-full bg-violet-500 transition-all"
                    style={{ width: `${ojtProgress.percent}%` }}
                  >
                    <div className="animate-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-4 dark:border-zinc-700/80 dark:bg-zinc-800/30">
            <div
              ref={hoursFilterWrapRef}
              className="relative flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Total hours
                </p>
                <div className="whitespace-nowrap text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 rounded" />
                  ) : (
                    formatMinutesAsHours(totalRegularMinutes)
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                id="user-calendar-hours-filter-trigger"
                aria-expanded={hoursFilterOpen}
                aria-controls="user-calendar-hours-filter-panel"
                disabled={isLoading}
                onClick={() => setHoursFilterOpen((o) => !o)}
                className="shrink-0 gap-1.5"
                leftIcon={<SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />}
                rightIcon={
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${hoursFilterOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                }
              >
                <span className="hidden sm:inline">Hours range</span>
              </Button>
              {hoursFilterOpen && (
                <div
                  id="user-calendar-hours-filter-panel"
                  role="region"
                  aria-labelledby="user-calendar-hours-filter-trigger"
                  className="absolute right-0 top-full z-50 mt-2 w-full max-w-sm flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Choose any dates (through today). Totals sum regular hours in that range. Reset matches the visible month (1st through today if current month).
                  </p>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="user-calendar-hours-from"
                        className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        From
                      </label>
                      <input
                        id="user-calendar-hours-from"
                        type="date"
                        value={draftFrom}
                        max={draftTo || todayIso}
                        onChange={handleDraftFromChange}
                        disabled={isLoading}
                        className="h-12 min-h-[48px] w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="user-calendar-hours-to"
                        className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        To
                      </label>
                      <input
                        id="user-calendar-hours-to"
                        type="date"
                        value={draftTo}
                        min={draftFrom || undefined}
                        max={todayIso}
                        onChange={handleDraftToChange}
                        disabled={isLoading}
                        className="h-12 min-h-[48px] w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="default"
                        onClick={applyDefaultHoursRange}
                        disabled={isLoading}
                        className="w-full"
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="default"
                        onClick={() => {
                          setHoursRangeFrom(draftFrom)
                          setHoursRangeTo(draftTo)
                          setHoursFilterOpen(false)
                        }}
                        disabled={isLoading}
                        className="w-full"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </PageSection>
        <PageSection className="min-w-0">
          <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 w-full items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-1 dark:border-zinc-700/80 dark:bg-zinc-800/50 sm:min-w-0 sm:flex-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              disabled={isLoading}
              className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-center text-sm font-semibold text-zinc-900 sm:px-4 sm:text-base dark:text-zinc-100">
              {monthLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              aria-label="Next month"
              disabled={isLoading}
              className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setViewDtrModalOpen(true)}
            disabled={isLoading}
            leftIcon={<Eye className="h-4 w-4 shrink-0" />}
            className="w-full min-h-[44px] shrink-0 sm:w-auto"
          >
            View DTR
          </Button>
        </div>

        {isLoading ? (
          <CalendarGridSkeleton bleed="user" />
        ) : (
        <div
          className="-mx-6 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="min-w-[480px] sm:min-w-[540px] md:min-w-[600px]">
            <div className="grid grid-cols-7 border-b border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700/80 dark:bg-zinc-800/30">
              {WEEKDAYS.map((day, idx) => (
                <div
                  key={day}
                  role="columnheader"
                  aria-label={day}
                  className="px-0.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-2 sm:py-3 sm:text-xs dark:text-zinc-400"
                >
                  <span className="sm:hidden" aria-hidden>
                    {WEEKDAYS_SHORT[idx]}
                  </span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, isCurrentMonth, isNextMonth, isPrevMonth }, i) => {
                const dateStr = toDateStr(date)
                const today = new Date()
                const todayStr = toDateStr(today)
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)
                const tomorrowStr = toDateStr(tomorrow)
                const dayOfWeek = date.getDay()
                const schedule =
                  scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
                const hasSchedule = !!schedule
                const existingAttendance = attendanceByDate.get(dateStr)
                const derivedStatus: AttendanceStatus =
                  hasSchedule
                    ? deriveAttendanceStatus({
                        hasSchedule: true,
                        hasTimeIn: !!existingAttendance?.timeIn,
                        hasTimeOut: !!existingAttendance?.timeOut,
                        scheduledTimeIn: schedule.timeIn,
                        actualTimeIn: existingAttendance?.timeIn ?? null,
                        dateStr,
                        todayStr,
                        tomorrowStr,
                        startDateStr: me.startDate ?? null,
                      })
                    : "no-schedule"
                const isFutureDay = dateStr > todayStr
                const status: AttendanceStatus =
                  !hasSchedule
                    ? "no-schedule"
                    : isFutureDay
                      ? derivedStatus
                      : existingAttendance?.approvalStatus === "pending" && !!existingAttendance?.timeIn
                        ? "pending"
                        : existingAttendance?.status === "absent" && !existingAttendance?.timeIn
                          ? "absent"
                          : existingAttendance?.status === "late"
                            ? "late"
                            : derivedStatus
                const showActualAttendanceTimes =
                  !!existingAttendance?.timeIn && !isFutureDay
                const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                const isToday = dateKey === todayKey
                const eligibleForCorrection =
                  existingAttendance &&
                  !isFutureDay &&
                  canRequestCorrection(existingAttendance, status)

                const cellBg =
                  isToday
                    ? "bg-blue-50/90 dark:bg-blue-950/50 ring-2 ring-inset ring-blue-600 dark:ring-blue-400"
                    : isPrevMonth
                      ? "bg-zinc-200/60 dark:bg-zinc-800/70"
                      : isNextMonth
                        ? "bg-zinc-100/80 dark:bg-zinc-800/50"
                        : "bg-white dark:bg-zinc-900"

                return (
                  <div
                    key={i}
                    className={`group min-h-[100px] border-b border-r border-zinc-200/80 p-1.5 transition-colors last:border-r-0 sm:min-h-[110px] sm:p-2 md:p-3 dark:border-zinc-700/80 ${cellBg} ${
                      isCurrentMonth && !isToday
                        ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                          isToday
                            ? "bg-blue-600 text-white shadow-md dark:bg-blue-500 dark:text-white"
                            : isCurrentMonth
                              ? "text-zinc-800 dark:text-zinc-200 group-hover:bg-zinc-200/60 dark:group-hover:bg-zinc-700/60"
                              : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {eligibleForCorrection && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCorrectionModalRow(existingAttendance)
                          }}
                          aria-label={`Request correction for ${date.toLocaleDateString("en-US")}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        >
                          <FilePenLine className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1 sm:mt-2 sm:space-y-1.5">
                      {hasSchedule ? (
                        <div className="space-y-0.5 text-[10px] sm:text-xs">
                          {showActualAttendanceTimes ? (
                            <>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">In: </span>
                                {formatTime12(existingAttendance.timeIn)}
                              </p>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">Out: </span>
                                {existingAttendance?.timeOut
                                  ? formatTime12(existingAttendance.timeOut)
                                  : "—"}
                              </p>
                              {existingAttendance?.timeIn &&
                                existingAttendance?.timeOut &&
                                schedule && (
                                  <p className="leading-tight font-medium text-zinc-600 dark:text-zinc-400">
                                    <span className="font-medium text-zinc-500 dark:text-zinc-500">Total: </span>
                                    {formatTotalWithOvertime(
                                      calcWorkMinutes(
                                        existingAttendance.timeIn,
                                        existingAttendance.timeOut,
                                        schedule.breakDuration ?? 0
                                      ),
                                      calcWorkMinutes(
                                        schedule.timeIn,
                                        schedule.timeOut,
                                        schedule.breakDuration ?? 0
                                      )
                                    )}
                                  </p>
                                )}
                            </>
                          ) : (
                            <p className="italic leading-tight text-zinc-500 dark:text-zinc-500">
                              {formatTime12(schedule.timeIn)} – {formatTime12(schedule.timeOut)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] italic leading-tight text-zinc-400 sm:text-xs dark:text-zinc-500">
                          No schedule
                        </p>
                      )}
                      <span
                        className={`inline-flex max-w-full rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs ${
                          LEGENDS.find((l) => l.status === status)?.bg ?? ""
                        } ${LEGENDS.find((l) => l.status === status)?.color ?? ""}`}
                      >
                        {LEGENDS.find((l) => l.status === status)?.label ?? "—"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )}

        <div className="flex flex-col gap-6 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Attendance
            </span>
            <div className="flex flex-wrap gap-2">
              {LEGENDS.map(({ status, label, bg, color, dot }) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg} ${color}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Date
            </span>
            <div className="flex flex-wrap gap-2">
              {DATE_LEGENDS.map(({ key, label, bg, dot, ring }) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg} ${ring ?? ""}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        </PageSection>
      </div>

      <ViewDtrModal
        open={viewDtrModalOpen}
        onClose={() => setViewDtrModalOpen(false)}
        currentMonthLabel={monthLabel}
        userId={me?.id ?? null}
        month={currentDate.getMonth() + 1}
        year={currentDate.getFullYear()}
        fileBaseName={buildDtrExportFileBaseName(me?.fullName ?? "Name", monthLabel)}
      />

      <RequestCorrectionModal
        open={!!correctionModalRow}
        onClose={() => setCorrectionModalRow(null)}
        row={correctionModalRow}
        onSuccess={handleCorrectionSuccess}
      />
    </UserPageLayout>
  )
}
