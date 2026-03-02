"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, User, Plus, Pencil, Download } from "lucide-react"
import { Button, Card } from "@/components/ui"
import { PageHeader } from "@/components/admin/page-header"
import { formatTime12 } from "@/lib/format-time"
import { calcWorkMinutes, formatMinutesAsHours, formatTotalWithOvertime } from "@/lib/time-calc"
import { deriveAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status"
import { generateCalendarPdf, type AttendanceExportRow, type ExportSummary } from "@/lib/calendar-pdf"
import { AttendanceModal, type AttendanceRow } from "./attendance-modal"
import { ExportPdfModal } from "./export-pdf-modal"

type UserRow = {
  id: string
  userId: string
  fullName: string
  username: string | null
  email: string
  contactNo: string | null
  position: string | null
  startDate: string | null
}

type ScheduleRow = {
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakTime: string | null
  breakDuration: number | null
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

const LEGENDS: { status: AttendanceStatus; label: string; color: string; bg: string }[] = [
  { status: "present", label: "Present", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  { status: "late", label: "Late", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  { status: "absent", label: "Absent", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
  { status: "upcoming", label: "Upcoming", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
  { status: "no-schedule", label: "No schedule", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800" },
]

const DATE_LEGENDS: { key: string; label: string; color: string; bg: string; dot: string }[] = [
  { key: "prev-month", label: "Previous month", color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-200 dark:bg-zinc-700", dot: "bg-zinc-500" },
  { key: "today", label: "Today", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", dot: "bg-blue-500" },
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
    .map((r: {
      dayOfWeek: number | null
      customDate: string | null
      timeIn: string
      timeOut: string
      breakTime: string | null
      breakDuration: number | null
    }) => ({
      dayOfWeek: r.dayOfWeek ?? null,
      customDate: r.customDate ?? null,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      breakTime: r.breakTime ?? null,
      breakDuration: r.breakDuration ?? null,
    }))
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
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoadingUsers(true)
      const data = await fetchUsers()
      setUsers(data)
      if (data.length > 0) {
        setSelectedUserId((prev) => prev || data[0].id)
      }
      setIsLoadingUsers(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedUserId) {
      setSchedules([])
      setAttendances([])
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoadingSchedules(true)
      const [schedData, attData] = await Promise.all([
        fetchUserSchedules(selectedUserId),
        (async () => {
          const year = currentDate.getFullYear()
          const month = currentDate.getMonth()
          const first = new Date(year, month, 1)
          const last = new Date(year, month + 1, 0)
          const startPad = first.getDay()
          const daysInMonth = last.getDate()
          const remaining = 42 - startPad - daysInMonth
          const firstVisible = new Date(year, month, 1 - startPad)
          const lastVisible = new Date(year, month + 1, remaining)
          const from = `${firstVisible.getFullYear()}-${String(firstVisible.getMonth() + 1).padStart(2, "0")}-${String(firstVisible.getDate()).padStart(2, "0")}`
          const to = `${lastVisible.getFullYear()}-${String(lastVisible.getMonth() + 1).padStart(2, "0")}-${String(lastVisible.getDate()).padStart(2, "0")}`
          return fetchAttendances(selectedUserId, from, to)
        })(),
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
  }, [selectedUserId, currentDate])

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
      map.set(a.date, a)
    }
    return map
  }, [attendances])

  const handleAttendanceSuccess = () => {
    if (!selectedUserId) return
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const daysInMonth = last.getDate()
    const remaining = 42 - startPad - daysInMonth
    const firstVisible = new Date(year, month, 1 - startPad)
    const lastVisible = new Date(year, month + 1, remaining)
    const from = `${firstVisible.getFullYear()}-${String(firstVisible.getMonth() + 1).padStart(2, "0")}-${String(firstVisible.getDate()).padStart(2, "0")}`
    const to = `${lastVisible.getFullYear()}-${String(lastVisible.getMonth() + 1).padStart(2, "0")}-${String(lastVisible.getDate()).padStart(2, "0")}`
    fetchAttendances(selectedUserId, from, to).then(setAttendances)
  }

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

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
      const status =
        selectedUserId && hasSchedule
          ? deriveAttendanceStatus({
              hasSchedule: true,
              hasTimeIn: !!existingAttendance?.timeIn,
              scheduledTimeIn: schedule.timeIn,
              actualTimeIn: existingAttendance?.timeIn ?? null,
              dateStr,
              todayStr,
              tomorrowStr,
              startDateStr: selectedUser?.startDate ?? null,
            })
          : "no-schedule"
      const statusLabel =
        status === "no-schedule" ? "—" : status.charAt(0).toUpperCase() + status.slice(1)
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

  const [isExporting, setIsExporting] = useState(false)

  const handleExportPdf = useCallback(
    async (opts: {
      mode: "month" | "custom"
      dateStart?: string
      dateEnd?: string
      supervisorName: string
      supervisorPosition: string
    }) => {
      const selectedUser = users.find((u) => u.id === selectedUserId)
      if (!selectedUser) return
      setIsExporting(true)
      try {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        let daysToExport: Date[]
        let periodLabel: string
        let attList: AttendanceRow[]

        if (opts.mode === "custom" && opts.dateStart && opts.dateEnd) {
          attList = await fetchAttendances(
            selectedUserId,
            opts.dateStart,
            opts.dateEnd
          )
          const start = new Date(opts.dateStart + "T00:00:00")
          const end = new Date(opts.dateEnd + "T23:59:59")
          daysToExport = []
          const cur = new Date(start)
          while (cur <= end) {
            daysToExport.push(new Date(cur))
            cur.setDate(cur.getDate() + 1)
          }
          periodLabel = `${start.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })} - ${end.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        } else {
          attList = attendances
          const last = new Date(year, month + 1, 0)
          const daysInMonth = last.getDate()
          daysToExport = []
          for (let d = 1; d <= daysInMonth; d++) {
            daysToExport.push(new Date(year, month, d))
          }
          periodLabel = currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })
        }

        const exportAttendanceByDate = new Map(
          attList.map((a) => [a.date, a])
        )

        const today = new Date()
        const todayStr = toDateStr(today)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = toDateStr(tomorrow)

        const rows: AttendanceExportRow[] = daysToExport.map((date) => {
          const dateStr = toDateStr(date)
          const dayOfWeek = date.getDay()
          const schedule =
            scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
          const hasSchedule = !!schedule
          const existingAttendance = exportAttendanceByDate.get(dateStr)
          const status =
            selectedUserId && hasSchedule
              ? deriveAttendanceStatus({
                  hasSchedule: true,
                  hasTimeIn: !!existingAttendance?.timeIn,
                  scheduledTimeIn: schedule.timeIn,
                  actualTimeIn: existingAttendance?.timeIn ?? null,
                  dateStr,
                  todayStr,
                  tomorrowStr,
                  startDateStr: selectedUser?.startDate ?? null,
                })
              : "no-schedule"
          const statusLabel =
            status === "no-schedule"
              ? "No schedule"
              : status.charAt(0).toUpperCase() + status.slice(1)
          const timeIn = existingAttendance?.timeIn
            ? formatTime12(existingAttendance.timeIn)
            : ""
          const timeOut = existingAttendance?.timeOut
            ? formatTime12(existingAttendance.timeOut)
            : ""
          const scheduledMinutes = schedule
            ? calcWorkMinutes(
                schedule.timeIn,
                schedule.timeOut,
                schedule.breakDuration ?? 0
              )
            : 0
          const totalMinutes =
            existingAttendance?.timeIn &&
            existingAttendance?.timeOut &&
            schedule
              ? calcWorkMinutes(
                  existingAttendance.timeIn,
                  existingAttendance.timeOut,
                  schedule.breakDuration ?? 0
                )
              : 0
          const total =
            totalMinutes > 0 && scheduledMinutes > 0
              ? formatTotalWithOvertime(totalMinutes, scheduledMinutes)
              : ""
          const dateDisplay =
            opts.mode === "month" && daysToExport.length > 14
              ? date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
          return {
            dateDisplay,
            timeIn,
            timeOut,
            status: statusLabel,
            total,
            totalMinutes,
          }
        })

        let totalRegular = 0
        let totalOvertime = 0
        let totalPresent = 0
        let totalLate = 0
        let totalAbsent = 0

        for (const row of rows) {
          if (row.status === "Present") totalPresent++
          if (row.status === "Late") totalLate++
          if (row.status === "Absent") totalAbsent++
        }

        for (const date of daysToExport) {
          const dateStr = toDateStr(date)
          const dayOfWeek = date.getDay()
          const schedule =
            scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)
          const existingAttendance = exportAttendanceByDate.get(dateStr)
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
            totalRegular += Math.min(actualM, scheduledM)
            if (actualM > scheduledM) totalOvertime += actualM - scheduledM
          }
        }

        const summary: ExportSummary = {
          totalHours: totalRegular,
          totalOvertime,
          totalPresent,
          totalLate,
          totalAbsent,
        }

        const pdfBytes = await generateCalendarPdf({
          userName: selectedUser.fullName,
          periodLabel,
          rows,
          summary,
          supervisorName: opts.supervisorName,
          supervisorPosition: opts.supervisorPosition,
        })
        const blob = new Blob(
          [
            pdfBytes.buffer.slice(
              pdfBytes.byteOffset,
              pdfBytes.byteOffset + pdfBytes.byteLength
            ) as ArrayBuffer,
          ],
          { type: "application/pdf" }
        )
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } finally {
        setIsExporting(false)
      }
    },
    [
      users,
      selectedUserId,
      currentDate,
      scheduleByDay,
      scheduleByDate,
      attendances,
    ]
  )

  const todayKey = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  }, [])

  const totalRegularMinutes = useMemo(() => {
    if (!selectedUserId) return 0
    let sum = 0
    for (const { date, isCurrentMonth } of calendarDays) {
      if (!isCurrentMonth) continue
      const dateStr = toDateStr(date)
      const dayOfWeek = date.getDay()
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
    }
    return sum
  }, [
    selectedUserId,
    calendarDays,
    scheduleByDay,
    scheduleByDate,
    attendanceByDate,
  ])

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="Calendar"
        description="View user schedules and attendance"
      />

      <Card variant="default" padding="none" className="min-w-0 p-4 sm:p-6">
        {selectedUserId && totalRegularMinutes > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/30">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Total hours this month
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {formatMinutesAsHours(totalRegularMinutes)}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-4 sm:gap-6 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 w-full sm:w-auto">
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
              <label
                htmlFor="calendar-user-select"
                className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300 text-sm shrink-0"
              >
                <User className="w-4 h-4 shrink-0" aria-hidden />
                Select user
              </label>
              <div className="relative w-full sm:min-w-[200px]">
                <select
                  id="calendar-user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isLoadingUsers}
                  className="h-11 w-full min-h-[44px] appearance-none rounded-xl border border-zinc-200/80 bg-white pl-4 pr-12 py-2 text-sm font-medium text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:border-zinc-500"
                  aria-label="Select user"
                >
                  <option value="">
                    {isLoadingUsers ? "Loading…" : "Choose a user"}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-zinc-500 dark:text-zinc-400"
                  aria-hidden
                />
              </div>
            </div>
            {selectedUserId && (() => {
              const u = users.find((x) => x.id === selectedUserId)
              if (!u) return null
              const extras = [u.position, u.userId && `ID: ${u.userId}`].filter(Boolean).join(" • ")
              return (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3 text-sm text-zinc-600 dark:text-zinc-400 min-w-0">
                  <span className="truncate" title={u.email}>
                    {u.email}
                  </span>
                  {extras && (
                    <span className="text-zinc-500 dark:text-zinc-500 truncate" title={extras}>
                      {extras}
                    </span>
                  )}
                </div>
              )
            })()}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-1 bg-zinc-50/50 dark:bg-zinc-800/50 p-1 border border-zinc-200 dark:border-zinc-700 rounded-xl w-full sm:w-auto justify-center">
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
              <span className="px-3 py-2 min-w-0 flex-1 sm:flex-none sm:min-w-[200px] font-semibold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base text-center">
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
              onClick={() => setExportPdfModalOpen(true)}
              disabled={!selectedUserId}
              leftIcon={<Download className="h-4 w-4 shrink-0" />}
              className="w-full sm:w-auto min-h-[44px]"
            >
              View Report
            </Button>
          </div>
        </div>

        <div
          className="bg-zinc-50/30 dark:bg-zinc-900/30 shadow-sm mt-6 sm:mt-8 border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 border-b">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 font-semibold text-zinc-500 dark:text-zinc-400 text-xs text-center uppercase tracking-wider"
                >
                  {day}
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
                const derivedStatus: AttendanceStatus =
                  selectedUserId && hasSchedule
                    ? deriveAttendanceStatus({
                        hasSchedule: true,
                        hasTimeIn: !!existingAttendance?.timeIn,
                        scheduledTimeIn: schedule.timeIn,
                        actualTimeIn: existingAttendance?.timeIn ?? null,
                        dateStr,
                        todayStr,
                        tomorrowStr,
                        startDateStr: selectedUser?.startDate ?? null,
                      })
                    : "no-schedule"
                const status: AttendanceStatus =
                  existingAttendance?.status === "absent" && !existingAttendance?.timeIn
                    ? "absent"
                    : existingAttendance?.status === "late"
                      ? "late"
                      : existingAttendance && !hasSchedule
                        ? (existingAttendance.status as AttendanceStatus)
                        : derivedStatus
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
                    className={`group min-h-[110px] border-b border-r border-zinc-200/80 p-3 transition-colors dark:border-zinc-700/80 ${cellBg} ${
                      isCurrentMonth && !isToday
                        ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                          isToday
                            ? "bg-blue-600 text-white shadow-md dark:bg-blue-500 dark:text-white"
                            : isCurrentMonth
                              ? "text-zinc-800 dark:text-zinc-200 group-hover:bg-zinc-200/60 dark:group-hover:bg-zinc-700/60"
                              : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {selectedUserId && (
                        <div className="flex items-center gap-0.5">
                          {!existingAttendance && (
                            <button
                              type="button"
                              onClick={() => openAddModal(date, dateLabel)}
                              aria-label={`Add attendance for ${dateLabel}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {existingAttendance && (
                            <button
                              type="button"
                              onClick={() => openEditModal(date, dateLabel, existingAttendance)}
                              aria-label={`Edit attendance for ${dateLabel}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedUserId && (
                      <div className="space-y-1.5 mt-2">
                        {hasSchedule ? (
                          <div className="space-y-0.5 text-xs">
                            {existingAttendance?.timeIn ? (
                              <>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-tight">
                                  <span className="font-medium text-zinc-500 dark:text-zinc-500">Time in: </span>
                                  {formatTime12(existingAttendance.timeIn)}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-tight">
                                  <span className="font-medium text-zinc-500 dark:text-zinc-500">Time out: </span>
                                  {existingAttendance?.timeOut
                                    ? formatTime12(existingAttendance.timeOut)
                                    : "—"}
                                </p>
                                {((schedule.breakDuration ?? 0) > 0 || schedule.breakTime) && (
                                  <p className="text-zinc-600 dark:text-zinc-400 leading-tight">
                                    <span className="font-medium text-zinc-500 dark:text-zinc-500">Break: </span>
                                    {schedule.breakTime
                                      ? `${formatTime12(schedule.breakTime)} (${schedule.breakDuration ?? 0}h)`
                                      : `${schedule.breakDuration ?? 0}h`}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-zinc-500 dark:text-zinc-500 leading-tight italic">
                                Scheduled: {formatTime12(schedule.timeIn)} – {formatTime12(schedule.timeOut)}
                                {((schedule.breakDuration ?? 0) > 0 || schedule.breakTime) &&
                                  ` • Break ${schedule.breakTime ? formatTime12(schedule.breakTime) + " " : ""}(${schedule.breakDuration ?? 0}h)`}
                              </p>
                            )}
                            {(existingAttendance?.timeIn && existingAttendance?.timeOut) && (
                              <p className="text-zinc-600 dark:text-zinc-400 leading-tight font-medium">
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
                          </div>
                        ) : existingAttendance ? (
                          <div className="space-y-0.5 text-xs">
                            {existingAttendance.timeIn ? (
                              <>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-tight">
                                  <span className="font-medium text-zinc-500 dark:text-zinc-500">Time in: </span>
                                  {formatTime12(existingAttendance.timeIn)}
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-tight">
                                  <span className="font-medium text-zinc-500 dark:text-zinc-500">Time out: </span>
                                  {existingAttendance.timeOut
                                    ? formatTime12(existingAttendance.timeOut)
                                    : "—"}
                                </p>
                                {(existingAttendance.timeIn && existingAttendance.timeOut) && (
                                  <p className="text-zinc-600 dark:text-zinc-400 leading-tight font-medium">
                                    <span className="font-medium text-zinc-500 dark:text-zinc-500">Total: </span>
                                    {formatTotalWithOvertime(
                                      calcWorkMinutes(
                                        existingAttendance.timeIn,
                                        existingAttendance.timeOut,
                                        0
                                      ),
                                      calcWorkMinutes(
                                        existingAttendance.timeIn,
                                        existingAttendance.timeOut,
                                        0
                                      )
                                    )}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-zinc-400 dark:text-zinc-500 italic leading-tight">
                                No time recorded
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-zinc-400 dark:text-zinc-500 text-xs italic leading-tight">
                            No schedule
                          </p>
                        )}
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            LEGENDS.find((l) => l.status === status)?.bg ?? ""
                          } ${LEGENDS.find((l) => l.status === status)?.color ?? ""}`}
                        >
                          {status === "no-schedule"
                            ? "—"
                            : status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-6 bg-zinc-50/50 dark:bg-zinc-900/30 mt-6 sm:mt-8 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm shrink-0">
              Attendance
            </span>
            <div className="flex flex-wrap gap-2 min-w-0">
              {LEGENDS.map(({ status, label, bg, color }) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg} ${color}`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      status === "present"
                        ? "bg-emerald-500"
                        : status === "late"
                          ? "bg-amber-500"
                          : status === "absent"
                            ? "bg-red-500"
                            : status === "upcoming"
                              ? "bg-violet-500"
                              : "bg-zinc-400"
                    }`}
                    aria-hidden
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm shrink-0">
              Date
            </span>
            <div className="flex flex-wrap gap-2 min-w-0">
              {DATE_LEGENDS.map(({ key, label, bg, color, dot }) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg} ${color}`}
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

      <ExportPdfModal
        open={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPdf}
        currentMonthLabel={monthLabel}
        disabled={isExporting}
      />
    </div>
  )
}
