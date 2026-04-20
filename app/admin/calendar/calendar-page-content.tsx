"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Plus, Pencil, Search, SlidersHorizontal } from "lucide-react"
import { Button, Card } from "@/components/ui"
import { CalendarGridSkeleton, CalendarToolbarSkeleton, Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/admin/page-header"
import { formatTime12 } from "@/lib/format-time"
import { calcWorkMinutes, formatMinutesAsHours, formatTotalWithOvertime } from "@/lib/time-calc"
import { deriveAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status"
import { AttendanceModal, type AttendanceRow } from "./attendance-modal"
import { ViewDtrModal } from "./view-dtr-modal"
import { buildDtrExportFileBaseName } from "@/lib/dtr/export-filename"
import type { ScheduleRow } from "@/types/schedule"
import { convertApiScheduleToScheduleRow } from "@/lib/schedule-utils"

type UserRow = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
  endDate: string | null
  role: "employee" | "admin" | "ojt"
  requiredHours?: number | null
}

type OjtProgress = {
  hoursCompleted: number
  requiredHours: number | null
  percent: number | null
}

type CalendarCell = {
  dateNum: number
  dateStr: string
  dayLabel: string
  status: string
  timeIn: string
  timeOut: string
  total: string
  isCurrentMonth: boolean
}


const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const LEGENDS: { status: AttendanceStatus; label: string; color: string; bg: string; dot: string }[] = [
  { status: "present", label: "Present", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40", dot: "bg-emerald-500" },
  { status: "late", label: "Late", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", dot: "bg-amber-500" },
  { status: "absent", label: "Absent", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", dot: "bg-red-500" },
  { status: "incomplete", label: "Incomplete", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40", dot: "bg-orange-500" },
  { status: "today", label: "Today", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", dot: "bg-blue-500" },
  { status: "upcoming", label: "Upcoming", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40", dot: "bg-violet-500" },
  { status: "no-schedule", label: "No schedule", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800", dot: "bg-zinc-400" },
]

const DATE_LEGENDS: { key: string; label: string; color: string; bg: string; dot: string; ring?: string }[] = [
  { key: "prev-month", label: "Previous month", color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-200 dark:bg-zinc-700", dot: "bg-zinc-500" },
  { key: "today", label: "Today", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", dot: "bg-blue-500", ring: "ring-2 ring-blue-500 dark:ring-blue-400" },
  { key: "upcoming", label: "Upcoming", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40", dot: "bg-violet-500" },
  { key: "next-month", label: "Next month", color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800", dot: "bg-zinc-400" },
]

const fetchUsers = async (): Promise<UserRow[]> => {
  const res = await fetch("/api/users")
  if (!res.ok) return []
  return res.json()
}

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

export const CalendarPageContent = () => {
  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)
  const [attendanceModal, setAttendanceModal] = useState<{
    open: boolean
    mode: "add" | "edit"
    date: string
    dateLabel: string
    attendance?: AttendanceRow | null
  } | null>(null)
  const [viewDtrModalOpen, setViewDtrModalOpen] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [hoursRangeFrom, setHoursRangeFrom] = useState("")
  const [hoursRangeTo, setHoursRangeTo] = useState("")
  const [draftFrom, setDraftFrom] = useState("")
  const [draftTo, setDraftTo] = useState("")
  const [hoursFilterOpen, setHoursFilterOpen] = useState(false)
  const [ojtProgress, setOjtProgress] = useState<OjtProgress | null>(null)
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
    const load = async () => {
      setIsLoadingUsers(true)
      const data = await fetchUsers()
      setUsers(data)
      setIsLoadingUsers(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedUserId) { setOjtProgress(null); return }
    const user = users.find((u) => u.id === selectedUserId)
    if (user?.role !== "ojt") { setOjtProgress(null); return }
    fetch(`/api/users/ojt-progress?userId=${selectedUserId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: Array<{ userId: string; hoursCompleted: number; requiredHours: number | null; percent: number | null }>) => {
        const entry = list[0] ?? null
        setOjtProgress(entry ? { hoursCompleted: entry.hoursCompleted, requiredHours: entry.requiredHours, percent: entry.percent } : null)
      })
      .catch(() => setOjtProgress(null))
  }, [selectedUserId, users])

  const mergedAttendanceFetchRange = useMemo(() => {
    const cal = getCalendarVisibleRange(currentDate)
    return mergeAttendanceFetchRanges(cal, hoursRangeFrom, hoursRangeTo)
  }, [currentDate, hoursRangeFrom, hoursRangeTo])

  useEffect(() => {
    if (!selectedUserId) {
      setSchedules([])
      setAttendances([])
      return
    }
    let cancelled = false
    setIsLoadingSchedules(true)
    const load = async () => {
      const { from, to } = mergedAttendanceFetchRange
      const [schedData, attData] = await Promise.all([
        fetchUserSchedules(selectedUserId),
        fetchAttendances(selectedUserId, from, to),
      ])
      if (!cancelled) {
        setSchedules(schedData)
        setAttendances(attData)
      }
      setIsLoadingSchedules(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedUserId, mergedAttendanceFetchRange])

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
      const key = typeof a.date === "string" ? a.date.slice(0, 10) : String(a.date).slice(0, 10)
      map.set(key, a)
    }
    return map
  }, [attendances])

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim()
    if (!q) return users
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userId?.toLowerCase().includes(q) ?? false) ||
        (u.contactNo?.toLowerCase().includes(q) ?? false)
    )
  }, [users, userSearch])

  const handleAttendanceSuccess = () => {
    if (!selectedUserId) return
    const { from, to } = mergedAttendanceFetchRange
    fetchAttendances(selectedUserId, from, to).then(setAttendances)
  }

  const openAddModal = (date: Date, dateLabel: string) => {
    const d = toDateStr(date)
    setAttendanceModal({ open: true, mode: "add", date: d, dateLabel })
  }

  const openEditModal = (date: Date, dateLabel: string, attendance: AttendanceRow) => {
    const d = toDateStr(date)
    setAttendanceModal({ open: true, mode: "edit", date: d, dateLabel, attendance })
  }

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

  const buildCellForDate = useCallback(
    (date: Date): CalendarCell => {
      const dateStr = toDateStr(date)
      const today = new Date()
      const todayStr = toDateStr(today)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = toDateStr(tomorrow)
      const selectedUser = users.find((u) => u.id === selectedUserId)
      const dayOfWeek = date.getDay()
      const schedule =
        scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
      const hasSchedule = !!schedule
      const existingAttendance = attendanceByDate.get(dateStr)
      const isPostTermination = selectedUser?.endDate != null && dateStr > selectedUser.endDate
      const derivedStatus =
        selectedUserId && hasSchedule && !isPostTermination
          ? deriveAttendanceStatus({
              hasSchedule: true,
              hasTimeIn: !!existingAttendance?.timeIn,
              hasTimeOut: !!existingAttendance?.timeOut,
              scheduledTimeIn: schedule.timeIn,
              actualTimeIn: existingAttendance?.timeIn ?? null,
              dateStr,
              todayStr,
              tomorrowStr,
              startDateStr: selectedUser?.startDate ?? null,
            })
          : "no-schedule"
      const status = derivedStatus
      const statusLabel = LEGENDS.find((l) => l.status === status)?.label ?? "—"
      const timeIn = existingAttendance?.timeIn
        ? formatTime12(existingAttendance.timeIn)
        : ""
      const timeOut = existingAttendance?.timeOut
        ? formatTime12(existingAttendance.timeOut)
        : ""
      const total =
        existingAttendance?.timeIn &&
        existingAttendance?.timeOut &&
        schedule
          ? formatTotalWithOvertime(
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
            )
          : ""
      const isCurrentMonth =
        date.getMonth() === currentDate.getMonth() &&
        date.getFullYear() === currentDate.getFullYear()
      return {
        dateNum: date.getDate(),
        dateStr,
        dayLabel: WEEKDAYS[dayOfWeek],
        status: statusLabel,
        timeIn,
        timeOut,
        total,
        isCurrentMonth,
      }
    },
    [
      selectedUserId,
      scheduleByDay,
      scheduleByDate,
      attendanceByDate,
      users,
      currentDate,
    ]
  )

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
    if (!selectedUserId) return 0
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
    selectedUserId,
    hoursRangeFrom,
    hoursRangeTo,
    scheduleByDay,
    scheduleByDate,
    attendanceByDate,
  ])

  const showCalendarSkeleton =
    isLoadingUsers || (!!selectedUserId && isLoadingSchedules)

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Calendar"
        description="View user schedules and attendance"
      />

      <Card
        variant="default"
        padding="none"
        className="min-w-0 p-4 md:p-6"
        aria-busy={showCalendarSkeleton}
      >
        {showCalendarSkeleton && (
          <span className="sr-only">Loading calendar data</span>
        )}
        {isLoadingUsers ? (
          <>
            <CalendarToolbarSkeleton />
            <CalendarGridSkeleton />
          </>
        ) : (
          <>
        <div className="mb-6 rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-4 dark:border-zinc-700/80 dark:bg-zinc-800/30">
          <div
            ref={hoursFilterWrapRef}
            className="relative flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Total hours
              </p>
              <div className="whitespace-nowrap text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {!selectedUserId ? (
                  "—"
                ) : isLoadingSchedules ? (
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
              id="calendar-hours-filter-trigger"
              aria-expanded={hoursFilterOpen}
              aria-controls="calendar-hours-filter-panel"
              disabled={!selectedUserId || isLoadingSchedules}
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
                id="calendar-hours-filter-panel"
                role="region"
                aria-labelledby="calendar-hours-filter-trigger"
                className="absolute right-0 top-full z-50 mt-2 w-full max-w-sm flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Choose any dates (through today). Totals sum regular hours in that range. Reset matches the visible month (1st through today if current month).
                </p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="calendar-hours-from"
                      className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      From
                    </label>
                    <input
                      id="calendar-hours-from"
                      type="date"
                      value={draftFrom}
                      max={draftTo || todayIso}
                      onChange={handleDraftFromChange}
                      disabled={!selectedUserId || isLoadingSchedules}
                      className="h-12 min-h-[48px] w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="calendar-hours-to"
                      className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      To
                    </label>
                    <input
                      id="calendar-hours-to"
                      type="date"
                      value={draftTo}
                      min={draftFrom || undefined}
                      max={todayIso}
                      onChange={handleDraftToChange}
                      disabled={!selectedUserId || isLoadingSchedules}
                      className="h-12 min-h-[48px] w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="default"
                      onClick={applyDefaultHoursRange}
                      disabled={!selectedUserId || isLoadingSchedules}
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
                      disabled={!selectedUserId || isLoadingSchedules}
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

        {ojtProgress && (
          <div className="mb-6 rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-4 dark:border-violet-700/60 dark:bg-violet-900/10">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">Required Time Progress</span>
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {ojtProgress.hoursCompleted} {ojtProgress.requiredHours != null ? `/ ${ojtProgress.requiredHours} hrs` : "hrs completed"}
                </span>
              </div>
              {ojtProgress.requiredHours != null && (
                <>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="relative h-3 overflow-hidden rounded-full bg-violet-500 transition-all"
                      style={{ width: `${ojtProgress.percent ?? 0}%` }}
                    >
                      <div className="animate-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    </div>
                  </div>
                  <p className="text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {ojtProgress.percent != null ? `${ojtProgress.percent}% complete` : ""}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <label
                htmlFor="calendar-user-search"
                className="flex shrink-0 items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                Search user
              </label>
              <div className="relative w-full min-w-0 flex-1 sm:min-w-[200px] md:min-w-[260px] lg:min-w-[320px]">
                <input
                  id="calendar-user-search"
                  type="text"
                  value={
                    userDropdownOpen
                      ? userSearch
                      : selectedUserId
                        ? (() => {
                            const u = users.find((x) => x.id === selectedUserId)
                            return u ? `${u.fullName} ID:${u.userId}` : ""
                          })()
                        : ""
                  }
                  onChange={(e) => {
                    setUserSearch(e.target.value)
                    setUserDropdownOpen(true)
                  }}
                  onFocus={() => {
                    setUserDropdownOpen(true)
                    if (!userSearch && selectedUserId) {
                      const u = users.find((x) => x.id === selectedUserId)
                      if (u) setUserSearch(`${u.fullName} ID:${u.userId}`)
                    }
                  }}
                  onBlur={() =>
                    setTimeout(() => setUserDropdownOpen(false), 150)
                  }
                  placeholder="Select or search user, id."
                  autoComplete="off"
                  aria-label="Search user"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="listbox"
                  className="h-11 w-full min-h-[44px] rounded-xl border border-zinc-200/80 bg-white pl-4 pr-4 py-2 text-sm font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
                {userDropdownOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {filteredUsers.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        No users found
                      </li>
                    ) : (
                      filteredUsers.map((u) => (
                        <li
                          key={u.id}
                          role="option"
                          tabIndex={0}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setSelectedUserId(u.id)
                            setUserSearch("")
                            setUserDropdownOpen(false)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSelectedUserId(u.id)
                              setUserSearch("")
                              setUserDropdownOpen(false)
                            }
                          }}
                          className="cursor-pointer px-4 py-2.5 text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
                        >
                          {u.fullName} ID:{u.userId}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex min-w-0 w-full items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50/50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50 lg:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="rounded-lg w-10 h-10 min-w-[44px] min-h-[44px] shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="px-3 py-2 min-w-0 flex-1 lg:flex-none lg:min-w-[180px] font-semibold text-zinc-900 dark:text-zinc-100 text-sm lg:text-base text-center truncate">
                {monthLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="rounded-lg w-10 h-10 min-w-[44px] min-h-[44px] shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setViewDtrModalOpen(true)}
              disabled={!selectedUserId}
              leftIcon={<Eye className="h-4 w-4 shrink-0" />}
              className="w-full lg:w-auto min-h-[44px] shrink-0"
            >
              View DTR
            </Button>
          </div>
        </div>

        {selectedUserId && isLoadingSchedules ? (
          <CalendarGridSkeleton />
        ) : (
        <div
          className="-mx-4 mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/30 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/30 md:-mx-6 md:mt-8"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
            <div className="min-w-[480px] sm:min-w-[540px] md:min-w-[600px]">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
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
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                const today = new Date()
                const todayStr = toDateStr(today)
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)
                const tomorrowStr = toDateStr(tomorrow)
                const selectedUser = users.find((u) => u.id === selectedUserId)
                const dayOfWeek = date.getDay()
                const schedule =
                  scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
                const hasSchedule = !!schedule
                const existingAttendance = attendanceByDate.get(dateStr)
                const isPostTermination = selectedUser?.endDate != null && dateStr > selectedUser.endDate
                const derivedStatus: AttendanceStatus =
                  selectedUserId && hasSchedule && !isPostTermination
                    ? deriveAttendanceStatus({
                        hasSchedule: true,
                        hasTimeIn: !!existingAttendance?.timeIn,
                        hasTimeOut: !!existingAttendance?.timeOut,
                        scheduledTimeIn: schedule.timeIn,
                        actualTimeIn: existingAttendance?.timeIn ?? null,
                        dateStr,
                        todayStr,
                        tomorrowStr,
                        startDateStr: selectedUser?.startDate ?? null,
                      })
                    : "no-schedule"
                const isFutureDay = dateStr > todayStr
                const status: AttendanceStatus =
                  !hasSchedule || isPostTermination
                    ? "no-schedule"
                    : isFutureDay
                      ? derivedStatus
                      : existingAttendance?.status === "absent" && !existingAttendance?.timeIn
                        ? "absent"
                        : existingAttendance?.status === "late"
                          ? "late"
                          : derivedStatus
                const showActualAttendanceTimes =
                  !!existingAttendance?.timeIn && !isFutureDay
                const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                const isToday = dateKey === todayKey
                const dateLabel = date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })

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
                    className={`group min-h-[100px] border-b border-r border-zinc-200/80 p-1.5 transition-colors sm:min-h-[110px] sm:p-2 md:p-3 dark:border-zinc-700/80 ${cellBg} ${
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
                      {selectedUserId && hasSchedule && (
                        <div className="flex items-center gap-0.5">
                          {!existingAttendance && (
                            <button
                              type="button"
                              onClick={() => openAddModal(date, dateLabel)}
                              aria-label={`Add attendance for ${dateLabel}`}
                              className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            >
                              <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                          )}
                          {existingAttendance && (
                            <button
                              type="button"
                              onClick={() => openEditModal(date, dateLabel, existingAttendance)}
                              aria-label={`Edit attendance for ${dateLabel}`}
                              className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            >
                              <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedUserId && (
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
                                {existingAttendance?.timeOut && (
                                  <p className="leading-tight font-medium text-zinc-600 dark:text-zinc-400">
                                    <span className="font-medium text-zinc-500 dark:text-zinc-500">Total: </span>
                                    {formatTotalWithOvertime(
                                      calcWorkMinutes(
                                        existingAttendance!.timeIn!,
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
                              <p className="leading-tight italic text-zinc-500 dark:text-zinc-500">
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
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )}
        </>
        )}

        <div className="flex flex-col gap-4 lg:gap-6 bg-zinc-50/50 dark:bg-zinc-900/30 mt-6 md:mt-8 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm shrink-0">
              Attendance
            </span>
            <div className="flex flex-wrap gap-2 min-w-0">
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
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm shrink-0">
              Date
            </span>
            <div className="flex flex-wrap gap-2 min-w-0">
              {DATE_LEGENDS.map(({ key, label, bg, color, dot, ring }) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg} ${color} ${ring ?? ""}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {attendanceModal && (
        <AttendanceModal
          open={attendanceModal.open}
          onClose={() => setAttendanceModal(null)}
          mode={attendanceModal.mode}
          date={attendanceModal.date}
          dateLabel={attendanceModal.dateLabel}
          userId={selectedUserId}
          attendance={attendanceModal.attendance}
          onSuccess={handleAttendanceSuccess}
        />
      )}

      <ViewDtrModal
        open={viewDtrModalOpen}
        onClose={() => setViewDtrModalOpen(false)}
        currentMonthLabel={monthLabel}
        userId={selectedUserId || null}
        month={currentDate.getMonth() + 1}
        year={currentDate.getFullYear()}
        fileBaseName={buildDtrExportFileBaseName(
          users.find((u) => u.id === selectedUserId)?.fullName ?? "Name",
          monthLabel
        )}
      />
    </div>
  )
}
