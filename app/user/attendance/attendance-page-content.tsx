"use client"

import { useCallback, useEffect, useState } from "react"
import { Clock, LogIn, LogOut } from "lucide-react"
import { Button, Pagination } from "@/components/ui"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { formatTime12 } from "@/lib/format-time"
import { swal } from "@/lib/swal"
import { isLate } from "@/lib/time-calc"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  username: string | null
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
}

type DisplayStatus = "present" | "late" | "absent"

const computeDisplayStatusForRow = (
  row: AttendanceRow,
  schedules: ScheduleRow[]
): DisplayStatus => {
  if (row.status === "absent") return "absent"
  if (row.status === "late") return "late"

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

const getTodayISO = () => {
  const d = new Date()
  return d.toISOString().split("T")[0] ?? ""
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
  })
  const [attendancePage, setAttendancePage] = useState(1)
  const [todaySchedule, setTodaySchedule] = useState<ScheduleForDay | null>(null)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isClockInLoading, setIsClockInLoading] = useState(false)
  const [isClockOutLoading, setIsClockOutLoading] = useState(false)

  const PAGE_SIZE = 10

  const getDateRange = () => {
    const now = new Date()
    const to = now.toISOString().split("T")[0] ?? ""
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0] ?? ""
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
      const { from, to } = getDateRange()

      const { from: rangeFrom, to: rangeTo } = getDateRange()
      const [attTodayRes, attListRes, schedRes] = await Promise.all([
        fetch(`/api/users/${userId}/attendances?from=${today}&to=${today}`),
        fetch(
          `/api/users/${userId}/attendances?from=${rangeFrom}&to=${rangeTo}&page=${attendancePage}&limit=${PAGE_SIZE}`
        ),
        fetch(`/api/users/${userId}/schedules`),
      ])

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

      if (attListRes.ok) {
        const data = await attListRes.json()
        const list = (data?.rows ?? (Array.isArray(data) ? data : [])) as AttendanceRow[]
        setAttendanceList(list)
        setAttendanceTotal(data?.total ?? list.length)

        const statsFromList = list.reduce(
          (acc, row) => {
            const displayStatus = computeDisplayStatusForRow(row, scheduleRows)
            if (displayStatus === "present") acc.present += 1
            else if (displayStatus === "late") acc.late += 1
            else acc.absent += 1
            return acc
          },
          { present: 0, late: 0, absent: 0 }
        )
        setAttendanceStats(statsFromList)
      } else {
        setAttendanceList([])
        setAttendanceTotal(0)
        setAttendanceStats({ present: 0, late: 0, absent: 0 })
      }
    } catch {
      setLoadError("Failed to load attendance")
    } finally {
      setIsLoading(false)
    }
  }, [attendancePage])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleClockIn = async () => {
    if (!me) return
    if (!todaySchedule) {
      swal.error("You have no schedule today. Please contact your admin to set up your schedule.")
      return
    }
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
          swal.error(data.error ?? "Failed to clock in")
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
          swal.error(data.error ?? "Failed to clock in")
          return
        }
      }
      await swal.success("Clocked in successfully")
      fetchData()
    } catch {
      swal.error("Failed to clock in")
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
        swal.error(data.error ?? "Failed to clock out")
        return
      }
      await swal.success("Clocked out successfully")
      fetchData()
    } catch {
      swal.error("Failed to clock out")
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
        title="Attendance"
        description="Time in and time out here"
        showUserDetails={true}
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
          <p className="text-red-600 dark:text-red-400">{loadError ?? "Unable to load attendance"}</p>
        </div>
      </UserPageLayout>
    )
  }

  return (
    <UserPageLayout
      title="Attendance"
      description="Time in and time out here"
      showUserDetails={true}
    >
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700 w-12 h-12">
                <Clock className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Today&apos;s Status
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {todaySchedule ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Scheduled: {formatTime12(todaySchedule.timeIn)} – {formatTime12(todaySchedule.timeOut)}
                </p>
                <div className="space-y-2">
                  {isDenied ? (
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Attendance was denied
                      </p>
                      <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                        You can clock in again tomorrow.
                      </p>
                      {attendance?.remarks && (
                        <p className="mt-2 text-sm text-red-600/90 dark:text-red-400/90">
                          Remarks: {attendance.remarks}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {hasTimeIn && (
                        <div className="flex items-center gap-2">
                          <LogIn className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-zinc-900 dark:text-zinc-100">
                            Time in: {formatTime12(attendance!.timeIn)}
                          </span>
                        </div>
                      )}
                      {hasTimeOut && (
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-zinc-900 dark:text-zinc-100">
                            Time out: {formatTime12(attendance!.timeOut)}
                          </span>
                        </div>
                      )}
                      {!hasTimeIn && !hasTimeOut && (
                        <p className="text-zinc-500 dark:text-zinc-400">
                          Not clocked in yet today.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  No schedule today
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400/90">
                  Contact your admin to set up your schedule before clocking in or out.
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleClockIn}
              disabled={!todaySchedule || hasTimeIn || isClockInLoading || isDenied}
              isLoading={isClockInLoading}
              leftIcon={<LogIn className="h-5 w-5" />}
              size="lg"
              className="w-full sm:w-auto min-w-[140px]"
              title={
                !todaySchedule
                  ? "No schedule today. Contact your admin to set up your schedule."
                  : isDenied
                    ? "Attendance denied. Try again tomorrow."
                    : undefined
              }
            >
              Clock In
            </Button>
            <Button
              variant="secondary"
              onClick={handleClockOut}
              disabled={!todaySchedule || !hasTimeIn || hasTimeOut || isClockOutLoading || isDenied}
              isLoading={isClockOutLoading}
              leftIcon={<LogOut className="h-5 w-5" />}
              size="lg"
              className="w-full sm:w-auto min-w-[140px]"
              title={
                !todaySchedule
                  ? "No schedule today. Contact your admin to set up your schedule."
                  : isDenied
                    ? "Attendance denied. Try again tomorrow."
                    : undefined
              }
            >
              Clock Out
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Attendance history
        </h2>
        {attendanceTotal > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {attendanceTotal}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Present
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                {attendanceStats.present}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Late
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">
                {attendanceStats.late}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Absent
              </p>
              <p className="mt-1 text-xl font-semibold text-zinc-700 dark:text-zinc-300">
                {attendanceStats.absent}
              </p>
            </div>
          </div>
        )}
        {attendanceTotal === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
            No attendance records in the last 30 days
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Date
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time In
                    </th>
                    <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time Out
                    </th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map((row) => {
                    const displayStatus = computeDisplayStatusForRow(row, schedules)
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
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              displayStatus === "present"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : displayStatus === "late"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
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
                        <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-[180px]">
                          {row.approvalStatus === "denied" && row.remarks
                            ? row.remarks
                            : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 sm:hidden">
              {attendanceList.map((row) => {
                const displayStatus = computeDisplayStatusForRow(row, schedules)
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize shrink-0 ${
                          displayStatus === "present"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : displayStatus === "late"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {row.timeIn ? formatTime12(row.timeIn) : "—"} –{" "}
                      {row.timeOut ? formatTime12(row.timeOut) : "—"}
                    </p>
                    {row.approvalStatus === "denied" && row.remarks && (
                      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                        Remarks: {row.remarks}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {attendanceTotal > 0 && (
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <Pagination
                  page={attendancePage}
                  total={attendanceTotal}
                  limit={PAGE_SIZE}
                  onPageChange={setAttendancePage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </UserPageLayout>
  )
}
