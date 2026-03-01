"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui"
import { formatTime12 } from "@/lib/format-time"
import { calcWorkMinutes, formatTotalWithOvertime } from "@/lib/time-calc"
import { deriveAttendanceStatus, type AttendanceStatus } from "@/lib/attendance-status"
import { generateCalendarPdf, type AttendanceExportRow, type ExportSummary } from "@/lib/calendar-pdf"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { ExportPdfModal } from "@/app/admin/calendar/export-pdf-modal"

type MeUser = {
  id: string
  fullName: string
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

type AttendanceRow = {
  id: string
  date: string
  status: string
  timeIn: string | null
  timeOut: string | null
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const LEGENDS: { status: AttendanceStatus; label: string; color: string; bg: string }[] = [
  { status: "present", label: "Present", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  { status: "late", label: "Late", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  { status: "absent", label: "Absent", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
  { status: "upcoming", label: "Upcoming", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
  { status: "no-schedule", label: "No schedule", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800" },
]

const DATE_LEGENDS: { key: string; label: string; bg: string; dot: string }[] = [
  { key: "prev-month", label: "Previous month", bg: "bg-zinc-200 dark:bg-zinc-700", dot: "bg-zinc-500" },
  { key: "today", label: "Today", bg: "bg-blue-100 dark:bg-blue-900/40", dot: "bg-blue-500" },
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

const fetchAttendances = async (
  userId: string,
  from: string,
  to: string
): Promise<AttendanceRow[]> => {
  const res = await fetch(
    `/api/users/${userId}/attendances?from=${from}&to=${to}&page=1&limit=500`
  )
  if (!res.ok) return []
  const data = await res.json()
  const rows = data?.rows ?? []
  return rows
}

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const UserCalendarPageContent = () => {
  const [me, setMe] = useState<MeUser | null>(null)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [attendances, setAttendances] = useState<AttendanceRow[]>([])
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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
    }
    loadMe()
  }, [])

  useEffect(() => {
    if (!me?.id) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const first = new Date(year, month, 1)
      const last = new Date(year, month + 1, 0)
      const startPad = first.getDay()
      const daysInMonth = last.getDate()
      const remaining = 42 - startPad - daysInMonth
      const firstVisible = new Date(year, month, 1 - startPad)
      const lastVisible = new Date(year, month + 1, remaining)
      const from = toDateStr(firstVisible)
      const to = toDateStr(lastVisible)

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
  }, [me?.id, currentDate])

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

  const handleExportPdf = useCallback(
    async (opts: {
      mode: "month" | "custom"
      dateStart?: string
      dateEnd?: string
      supervisorName: string
      supervisorPosition: string
    }) => {
      if (!me) return
      setIsExporting(true)
      try {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        let daysToExport: Date[]
        let periodLabel: string
        let attList: AttendanceRow[]

        if (opts.mode === "custom" && opts.dateStart && opts.dateEnd) {
          attList = await fetchAttendances(me.id, opts.dateStart, opts.dateEnd)
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

        const exportAttendanceByDate = new Map(attList.map((a) => [a.date, a]))

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
          const status = hasSchedule
            ? deriveAttendanceStatus({
                hasSchedule: true,
                hasTimeIn: !!existingAttendance?.timeIn,
                scheduledTimeIn: schedule.timeIn,
                actualTimeIn: existingAttendance?.timeIn ?? null,
                dateStr,
                todayStr,
                tomorrowStr,
                startDateStr: me.startDate ?? null,
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
          userName: me.fullName,
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
    [me, currentDate, scheduleByDay, scheduleByDate, attendances]
  )

  const todayKey = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  }, [])

  if (isLoading && !me) {
    return (
      <UserPageLayout
        title="Calendar"
        description="View your attendance calendar"
        showUserDetails={true}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white py-16 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        </div>
      </UserPageLayout>
    )
  }

  if (loadError || !me) {
    return (
      <UserPageLayout
        title="Calendar"
        description="View your attendance calendar"
        showUserDetails={true}
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
          <p className="text-red-600 dark:text-red-400">{loadError ?? "Unable to load calendar"}</p>
        </div>
      </UserPageLayout>
    )
  }

  return (
    <UserPageLayout
      title="Calendar"
      description="View your attendance calendar"
      showUserDetails={true}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-1 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="rounded-lg h-9 w-9"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="min-w-[200px] px-4 py-1.5 text-center text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {monthLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="rounded-lg h-9 w-9"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExportPdfModalOpen(true)}
            leftIcon={<Download className="h-4 w-4" />}
          >
            View Report
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 border-b border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700/80 dark:bg-zinc-800/30">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  {day}
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
                        scheduledTimeIn: schedule.timeIn,
                        actualTimeIn: existingAttendance?.timeIn ?? null,
                        dateStr,
                        todayStr,
                        tomorrowStr,
                        startDateStr: me.startDate ?? null,
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
                    className={`group min-h-[110px] border-b border-r border-zinc-200/80 p-3 transition-colors dark:border-zinc-700/80 last:border-r-0 ${cellBg} ${
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
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {hasSchedule ? (
                        <div className="space-y-0.5 text-xs">
                          {existingAttendance?.timeIn ? (
                            <>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">Time in: </span>
                                {formatTime12(existingAttendance.timeIn)}
                              </p>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">Time out: </span>
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
                              Scheduled: {formatTime12(schedule.timeIn)} – {formatTime12(schedule.timeOut)}
                            </p>
                          )}
                        </div>
                      ) : existingAttendance ? (
                        <div className="space-y-0.5 text-xs">
                          {existingAttendance.timeIn ? (
                            <>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">Time in: </span>
                                {formatTime12(existingAttendance.timeIn)}
                              </p>
                              <p className="leading-tight text-zinc-600 dark:text-zinc-400">
                                <span className="font-medium text-zinc-500 dark:text-zinc-500">Time out: </span>
                                {existingAttendance.timeOut
                                  ? formatTime12(existingAttendance.timeOut)
                                  : "—"}
                              </p>
                            </>
                          ) : (
                            <p className="italic leading-tight text-zinc-400 dark:text-zinc-500">
                              No time recorded
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs italic leading-tight text-zinc-400 dark:text-zinc-500">
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
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Attendance
            </span>
            <div className="flex flex-wrap gap-2">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Date
            </span>
            <div className="flex flex-wrap gap-2">
              {DATE_LEGENDS.map(({ key, label, bg, dot }) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm ${bg}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ExportPdfModal
        open={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPdf}
        currentMonthLabel={monthLabel}
        disabled={isExporting}
      />
    </UserPageLayout>
  )
}
