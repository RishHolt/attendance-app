"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Clock, LogIn, LogOut, Edit3 } from "lucide-react"
import { Button, Pagination } from "@/components/ui"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { PageSection } from "@/components/user/page-section"
import { RequestCorrectionModal } from "./request-correction-modal"
import { formatTime12 } from "@/lib/format-time"
import { swal } from "@/lib/swal"
import { calcWorkMinutes, isLate } from "@/lib/time-calc"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  startDate?: string | null
  status?: "active" | "inactive"
}

type AttendanceRow = {
  id: string
  userId: string
  date: string
  status: string
  approvalStatus?: "pending" | "approved" | "denied"
  timeIn: string | null
  timeOut: string | null
  remarks?: string | null
  correctionStatus?: string | null
  correctionId?: string | null
}

type ScheduleForDay = {
  timeIn: string
  timeOut: string
}

type ScheduleRow = {
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakTime?: string | null
  breakDuration?: number | null
}

type DisplayStatus = "present" | "late" | "absent" | "incomplete" | "pending"

const computeDisplayStatusForRow = (
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

  const date = new Date(row.date + "T00:00:00")
  if (Number.isNaN(date.getTime())) {
    return row.status === "present" ? "present" : "absent"
  }

  const dayOfWeek = date.getDay()
  const schedule =
    schedules.find((s) => s.customDate === row.date) ??
    schedules.find((s) => s.customDate == null && s.dayOfWeek === dayOfWeek)

  if (!schedule) {
    return row.status === "present" ? "present" : "absent"
  }

  return isLate(row.timeIn, schedule.timeIn) ? "late" : "present"
}

const getScheduleForRow = (
  row: AttendanceRow,
  schedules: ScheduleRow[]
): ScheduleRow | null => {
  const date = new Date(row.date + "T00:00:00")
  if (Number.isNaN(date.getTime())) return null
  const dayOfWeek = date.getDay()
  return (
    schedules.find((s) => s.customDate === row.date) ??
    schedules.find((s) => s.customDate == null && s.dayOfWeek === dayOfWeek) ??
    null
  )
}

const hasScheduleForDate = (
  schedules: ScheduleRow[],
  dateStr: string
): boolean => {
  const date = new Date(dateStr + "T00:00:00")
  if (Number.isNaN(date.getTime())) return false
  const dayOfWeek = date.getDay()
  return (
    schedules.some((s) => s.customDate === dateStr) ||
    schedules.some((s) => s.customDate == null && s.dayOfWeek === dayOfWeek)
  )
}

const formatTotalHours = (
  row: AttendanceRow,
  schedules: ScheduleRow[]
): string => {
  if (!row.timeIn || !row.timeOut) return "—"
  const schedule = getScheduleForRow(row, schedules)
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

const getTodayISO = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getCurrentTime = () => {
  const d = new Date()
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export const AttendancePageContent = () => {
  const [me, setMe] = useState<MeUser | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow | null>(null)
  const [attendanceList, setAttendanceList] = useState<AttendanceRow[]>([])
  const [attendanceTotal, setAttendanceTotal] = useState(0)
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    incomplete: 0,
  })
  const [attendancePage, setAttendancePage] = useState(1)
  const [todaySchedule, setTodaySchedule] = useState<ScheduleForDay | null>(null)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isClockInLoading, setIsClockInLoading] = useState(false)
  const [isClockOutLoading, setIsClockOutLoading] = useState(false)
  const [correctionModalRow, setCorrectionModalRow] = useState<AttendanceRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all")

  const PAGE_SIZE = 10

  const getDateRange = (startDate: string | null) => {
    const now = new Date()
    const to = now.toISOString().split("T")[0] ?? ""
    const trimmed = startDate?.trim()?.slice(0, 10)
    const fallback = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? ""
    const from = trimmed && trimmed <= to ? trimmed : fallback
    return { from, to }
  }

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
      const { from: rangeFrom, to: rangeTo } = getDateRange(meData.startDate ?? null)

      const [attTodayRes, schedRes, firstAttRes] = await Promise.all([
        fetch(`/api/users/${userId}/attendances?from=${today}&to=${today}`),
        fetch(`/api/users/${userId}/schedules`),
        fetch(
          `/api/users/${userId}/attendances?from=${rangeFrom}&to=${rangeTo}&page=1&limit=1000`
        ),
      ])

      let allAttList: AttendanceRow[] = []
      if (firstAttRes.ok) {
        const firstData = await firstAttRes.json()
        const firstRows = (firstData?.rows ?? (Array.isArray(firstData) ? firstData : [])) as AttendanceRow[]
        const total = typeof firstData?.total === "number" ? firstData.total : firstRows.length
        allAttList = firstRows
        if (total > 1000) {
          const extraPages = Math.ceil(total / 1000) - 1
          const extraRes = await Promise.all(
            Array.from({ length: extraPages }, (_, i) =>
              fetch(
                `/api/users/${userId}/attendances?from=${rangeFrom}&to=${rangeTo}&page=${i + 2}&limit=1000`
              )
            )
          )
          for (const res of extraRes) {
            if (res.ok) {
              const data = await res.json()
              const rows = (data?.rows ?? (Array.isArray(data) ? data : [])) as AttendanceRow[]
              allAttList = allAttList.concat(rows)
            }
          }
          allAttList.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
        }
      }

      if (attTodayRes.ok) {
        const attData = await attTodayRes.json()
        const arr = attData?.rows ?? (Array.isArray(attData) ? attData : [])
        setAttendance(arr.length > 0 ? arr[0] : null)
      } else {
        setAttendance(null)
      }

      let scheduleRows: ScheduleRow[] = []

      if (schedRes.ok) {
        const schedData = await schedRes.json()
        const rows = (schedData.rows ?? []) as ScheduleRow[]
        scheduleRows = rows
        setSchedules(rows)

        const todayDate = new Date()
        const dayOfWeek = todayDate.getDay()
        const todayStr = todayDate.toISOString().split("T")[0]

        const customMatch = rows.find((r) => r.customDate === todayStr)
        const recurringMatch = rows.find((r) => r.customDate == null && r.dayOfWeek === dayOfWeek)
        const match = customMatch ?? recurringMatch
        if (match) {
          setTodaySchedule({
            timeIn: match.timeIn ?? "09:00",
            timeOut: match.timeOut ?? "17:00",
          })
        } else {
          setTodaySchedule(null)
        }
      } else {
        setSchedules([])
        setTodaySchedule(null)
      }

      if (firstAttRes.ok) {
        const attList = allAttList
        const total = attList.length

        setAttendanceList(attList)
        setAttendanceTotal(total)

        const statsFromList = attList.reduce(
          (acc, row) => {
            const displayStatus = computeDisplayStatusForRow(row, scheduleRows)
            if (displayStatus === "pending") return acc
            if (displayStatus === "present") acc.present += 1
            else if (displayStatus === "late") acc.late += 1
            else if (displayStatus === "incomplete") acc.incomplete += 1
            else acc.absent += 1
            return acc
          },
          { present: 0, late: 0, absent: 0, incomplete: 0 }
        )
        setAttendanceStats(statsFromList)
      } else {
        setAttendanceList([])
        setAttendanceTotal(0)
        setAttendanceStats({ present: 0, late: 0, absent: 0, incomplete: 0 })
      }
    } catch {
      setLoadError("Failed to load attendance")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setAttendancePage(1)
  }, [statusFilter])

  const filteredList = useMemo(() => {
    if (statusFilter === "all") return attendanceList
    return attendanceList.filter((row) => computeDisplayStatusForRow(row, schedules) === statusFilter)
  }, [attendanceList, statusFilter, schedules])

  const filteredTotal = filteredList.length

  const paginatedRows = useMemo(() => {
    const start = (attendancePage - 1) * PAGE_SIZE
    return filteredList.slice(start, start + PAGE_SIZE)
  }, [filteredList, attendancePage])

  const filteredStats = useMemo(
    () =>
      filteredList.reduce(
        (acc, row) => {
          const displayStatus = computeDisplayStatusForRow(row, schedules)
          if (displayStatus === "pending") return acc
          if (displayStatus === "present") acc.present += 1
          else if (displayStatus === "late") acc.late += 1
          else if (displayStatus === "incomplete") acc.incomplete += 1
          else acc.absent += 1
          return acc
        },
        { present: 0, late: 0, absent: 0, incomplete: 0 }
      ),
    [filteredList, schedules]
  )

  const handleClockIn = async () => {
    if (!me) return
    setIsClockInLoading(true)
    try {
      const today = getTodayISO()
      const now = getCurrentTime()
      if (attendance) {
        const res = await fetch(`/api/users/${me.id}/attendances/${attendance.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "present",
            timeIn: now,
            timeOut: attendance.timeOut ?? null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          swal.error(data.error ?? "Failed to time in")
          return
        }
      } else {
        const res = await fetch(`/api/users/${me.id}/attendances`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: today,
            status: "present",
            timeIn: now,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          swal.error(data.error ?? "Failed to time in")
          return
        }
      }
      await swal.success("Clocked in successfully")
      fetchData()
    } catch {
      swal.error("Failed to time in")
    } finally {
      setIsClockInLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!me || !attendance) return
    setIsClockOutLoading(true)
    try {
      const now = getCurrentTime()
      const res = await fetch(`/api/users/${me.id}/attendances/${attendance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "present",
          timeIn: attendance.timeIn ?? null,
          timeOut: now,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to time out")
        return
      }
      await swal.success("Clocked out successfully")
      fetchData()
    } catch {
      swal.error("Failed to time out")
    } finally {
      setIsClockOutLoading(false)
    }
  }

  const hasTimeIn = !!attendance?.timeIn
  const hasTimeOut = !!attendance?.timeOut
  const isDenied = attendance?.approvalStatus === "denied"

  if (isLoading) {
    return (
      <UserPageLayout
        title="Attendance"
        description="Time in and time out here"
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
        title="Attendance"
        description="Time in and time out here"
      >
        <PageSection>
          <p className="text-red-600 dark:text-red-400" role="alert">
            {loadError ?? "Unable to load attendance"}
          </p>
        </PageSection>
      </UserPageLayout>
    )
  }

  return (
    <UserPageLayout
      title="Attendance"
      description="Time in and time out here"
    >
      <PageSection title="Today's status" padding="lg">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50/80 to-white dark:border-zinc-700/50 dark:from-zinc-900/40 dark:to-zinc-900/80">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              {/* Status & times */}
              <div className="flex min-w-0 flex-1">
                <div className="flex gap-4 sm:gap-6">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 ${isDenied
                        ? "bg-red-100 dark:bg-red-900/40"
                        : hasTimeOut
                          ? "bg-emerald-100 dark:bg-emerald-900/40"
                          : hasTimeIn
                            ? "bg-amber-100 dark:bg-amber-900/40"
                            : "bg-zinc-100 dark:bg-zinc-800"
                      }`}
                  >
                    {isDenied ? (
                      <Clock className="h-7 w-7 text-red-600 dark:text-red-400 sm:h-8 sm:w-8" />
                    ) : hasTimeOut ? (
                      <LogOut className="h-7 w-7 text-emerald-600 dark:text-emerald-400 sm:h-8 sm:w-8" />
                    ) : hasTimeIn ? (
                      <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400 sm:h-8 sm:w-8" />
                    ) : (
                      <LogIn className="h-7 w-7 text-zinc-500 dark:text-zinc-400 sm:h-8 sm:w-8" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100 sm:text-xl">
                      {isDenied
                        ? "Attendance denied"
                        : hasTimeOut
                          ? "Timed out"
                          : hasTimeIn
                            ? "Timed in"
                            : "Not timed in"}
                    </h3>
                    {todaySchedule && !isDenied && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Scheduled: {formatTime12(todaySchedule.timeIn)} – {formatTime12(todaySchedule.timeOut)}
                      </p>
                    )}
                    {(hasTimeIn || hasTimeOut) && !isDenied && (
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                        {hasTimeIn && (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Time in
                            </p>
                            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatTime12(attendance!.timeIn)}
                            </p>
                          </div>
                        )}
                        {hasTimeOut && (
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                              Time out
                            </p>
                            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatTime12(attendance!.timeOut)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {isDenied && (
                      <div className="mt-3 space-y-2">
                        {attendance?.remarks && (
                          <p className="text-sm text-red-600/90 dark:text-red-400/90">
                            Remarks: {attendance.remarks}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {attendance.correctionStatus === "pending" && (
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                          {attendance.correctionStatus === "approved" && (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                              Approved
                            </span>
                          )}
                          {attendance.correctionStatus === "rejected" && (
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                              Denied
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:justify-end">
                {me?.status === "inactive" ? (
                  <div className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 dark:border-red-800/50 dark:bg-red-950/20">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Your account is inactive. Time in/out is disabled.
                    </p>
                  </div>
                ) : todaySchedule ? (
                  <>
                    <Button
                      onClick={handleClockIn}
                      disabled={hasTimeIn || isClockInLoading || isDenied}
                      isLoading={isClockInLoading}
                      leftIcon={<LogIn className="h-5 w-5" />}
                      size="lg"
                      className="min-w-[140px] sm:w-auto"
                      title={
                        isDenied
                          ? "Attendance denied. Try again tomorrow."
                          : undefined
                      }
                    >
                      Time In
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleClockOut}
                      disabled={!hasTimeIn || hasTimeOut || isClockOutLoading || isDenied}
                      isLoading={isClockOutLoading}
                      leftIcon={<LogOut className="h-5 w-5" />}
                      size="lg"
                      className="min-w-[140px] sm:w-auto"
                      title={
                        isDenied
                          ? "Attendance denied. Try again tomorrow."
                          : undefined
                      }
                    >
                      Time Out
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      No schedule today
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400/90">
                      Contact your admin to set up your schedule.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageSection>

      <RequestCorrectionModal
        open={!!correctionModalRow}
        onClose={() => setCorrectionModalRow(null)}
        row={correctionModalRow}
        onSuccess={() => {
          fetchData()
          swal.success("Correction request submitted")
        }}
      />

      <PageSection title="Attendance history">
        {attendanceTotal > 0 && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <label htmlFor="status-filter" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Filter by status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DisplayStatus | "all")}
                aria-label="Filter attendance by status"
                className="min-h-[44px] min-w-[140px] flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-zinc-500 sm:flex-initial"
              >
                <option value="all">All</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="incomplete">Incomplete</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {filteredTotal}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Present
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                  {filteredStats.present}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Late
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
                  {filteredStats.late}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-3 dark:border-orange-900/50 dark:bg-orange-950/30">
                <p className="text-xs font-medium uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Incomplete
                </p>
                <p className="mt-1 text-xl font-semibold text-orange-700 dark:text-orange-300">
                  {filteredStats.incomplete}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Absent
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-700 dark:text-zinc-300">
                  {filteredStats.absent}
                </p>
              </div>
            </div>
          </>
        )}
        {attendanceTotal === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No attendance records from start date to current
          </p>
        ) : filteredTotal === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No records match the selected filter
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Attendance Status
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Admin Approval
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time In
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time Out
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Total Hours
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Remarks
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Request Status
                    </th>
                    <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const displayStatus = computeDisplayStatusForRow(row, schedules)
                    const canRequestCorrection =
                      me?.status !== "inactive" &&
                      (displayStatus === "late" ||
                        displayStatus === "absent" ||
                        displayStatus === "incomplete" ||
                        row.approvalStatus === "denied") &&
                      row.correctionStatus !== "pending"
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0"
                      >
                        <td className="py-3 pr-4 text-sm text-zinc-900 dark:text-zinc-100">
                          {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${displayStatus === "pending"
                                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                : displayStatus === "present"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  : displayStatus === "late"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                    : displayStatus === "incomplete"
                                      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {displayStatus === "absent" ? (
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">—</span>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${row.approvalStatus === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  : row.approvalStatus === "denied"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                }`}
                            >
                              {row.approvalStatus ?? "pending"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeIn ? formatTime12(row.timeIn) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {row.timeOut ? formatTime12(row.timeOut) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatTotalHours(row, schedules)}
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-[180px]">
                          {row.approvalStatus === "denied" && row.remarks ? row.remarks : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {row.correctionStatus === "pending" && (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                          {row.correctionStatus === "approved" && (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                              approved
                            </span>
                          )}
                          {row.correctionStatus === "rejected" && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">
                              denied
                            </span>
                          )}
                          {!row.correctionStatus && "—"}
                        </td>
                        <td className="py-3 text-right">
                          {canRequestCorrection && (
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Edit3 className="h-3 w-3" />}
                              onClick={() => setCorrectionModalRow(row as AttendanceRow)}
                              aria-label={`Request correction for ${row.date}`}
                              disabled={row.correctionStatus === "pending"}
                            >
                              Request correction
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 sm:hidden">
              {paginatedRows.map((row) => {
                const displayStatus = computeDisplayStatusForRow(row, schedules)
                const canRequestCorrection =
                  me?.status !== "inactive" &&
                  (displayStatus === "late" ||
                    displayStatus === "absent" ||
                    displayStatus === "incomplete" ||
                    row.approvalStatus === "denied") &&
                  row.correctionStatus !== "pending"
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${displayStatus === "pending"
                              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              : displayStatus === "present"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : displayStatus === "late"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                  : displayStatus === "incomplete"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                        >
                          {displayStatus}
                        </span>
                        {displayStatus === "absent" ? (
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">—</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${row.approvalStatus === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : row.approvalStatus === "denied"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              }`}
                          >
                            {row.approvalStatus ?? "pending"}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {row.timeIn ? formatTime12(row.timeIn) : "—"} –{" "}
                      {row.timeOut ? formatTime12(row.timeOut) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Total: {formatTotalHours(row, schedules)}
                    </p>
                    {row.approvalStatus === "denied" && row.remarks && (
                      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                        Remarks: {row.remarks}
                      </p>
                    )}
                    {(canRequestCorrection || row.correctionStatus) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {canRequestCorrection && (
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Edit3 className="h-3 w-3" />}
                            onClick={() => setCorrectionModalRow(row as AttendanceRow)}
                            disabled={row.correctionStatus === "pending"}
                          >
                            Request correction
                          </Button>
                        )}
                        {row.correctionStatus === "pending" && (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            Request Status: Pending
                          </span>
                        )}
                        {row.correctionStatus === "approved" && (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            approved
                          </span>
                        )}
                        {row.correctionStatus === "rejected" && (
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            Request Status: denied
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filteredTotal > 0 && (
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <Pagination
                  page={attendancePage}
                  total={filteredTotal}
                  limit={PAGE_SIZE}
                  onPageChange={setAttendancePage}
                />
              </div>
            )}
          </>
        )}
      </PageSection>
    </UserPageLayout>
  )
}
