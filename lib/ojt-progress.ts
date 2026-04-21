import { calcWorkMinutes } from "@/lib/time-calc"

type AttendanceRow = {
  time_in: string | null
  time_out: string | null
  approval_status?: string | null
}

type AttendanceWithDate = AttendanceRow & { attendance_date: string }

type ScheduleRow = {
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakDuration: number | null
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function calcOjtHoursWithSchedules(
  attendances: AttendanceWithDate[],
  schedules: ScheduleRow[]
): number {
  const scheduleByDate = new Map<string, ScheduleRow>()
  const scheduleByDay = new Map<number, ScheduleRow>()
  for (const s of schedules) {
    if (s.customDate) scheduleByDate.set(s.customDate, s)
    else if (s.dayOfWeek != null) scheduleByDay.set(s.dayOfWeek, s)
  }

  let totalMinutes = 0
  for (const a of attendances) {
    if (!a.time_in || !a.time_out) continue
    if (a.approval_status && a.approval_status !== "approved") continue
    const dateStr = a.attendance_date
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay()
    const schedule = scheduleByDate.get(dateStr) ?? scheduleByDay.get(dayOfWeek)

    if (schedule) {
      const actualM = calcWorkMinutes(a.time_in, a.time_out, schedule.breakDuration ?? 0)
      const scheduledM = calcWorkMinutes(schedule.timeIn, schedule.timeOut, schedule.breakDuration ?? 0)
      totalMinutes += Math.min(actualM, scheduledM)
    } else {
      const inMin = parseMinutes(a.time_in)
      const outMin = parseMinutes(a.time_out)
      if (outMin > inMin) totalMinutes += outMin - inMin
    }
  }
  return minutesToHours(totalMinutes)
}

function parseMinutes(t: string): number {
  const parts = t.split(":")
  const h = parseInt(parts[0] ?? "0", 10)
  const m = parseInt(parts[1] ?? "0", 10)
  return h * 60 + m
}

export function calcOjtProgress(
  attendances: AttendanceWithDate[],
  schedules: ScheduleRow[],
  requiredHours: number | null
): { hoursCompleted: number; requiredHours: number | null; percent: number | null } {
  const hoursCompleted = calcOjtHoursWithSchedules(attendances, schedules)
  const percent =
    requiredHours != null && requiredHours > 0
      ? Math.min(100, Math.round((hoursCompleted / requiredHours) * 100))
      : null
  return { hoursCompleted, requiredHours, percent }
}
