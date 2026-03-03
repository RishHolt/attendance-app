import { isLate } from "./time-calc"

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "incomplete"
  | "upcoming"
  | "no-schedule"

export type DeriveStatusInput = {
  hasSchedule: boolean
  hasTimeIn: boolean
  hasTimeOut: boolean
  scheduledTimeIn: string
  actualTimeIn: string | null
  dateStr: string
  todayStr: string
  tomorrowStr: string
  startDateStr: string | null
}

/**
 * Derive display status from schedule and attendance data.
 * incomplete = has time_in but no time_out (forgot to clock out)
 */
export function deriveAttendanceStatus(input: DeriveStatusInput): AttendanceStatus {
  const {
    hasSchedule,
    hasTimeIn,
    hasTimeOut,
    scheduledTimeIn,
    actualTimeIn,
    dateStr,
    todayStr,
    tomorrowStr,
    startDateStr,
  } = input

  if (!hasSchedule) return "no-schedule"

  if (hasTimeIn && actualTimeIn) {
    if (!hasTimeOut) return "incomplete"
    return isLate(actualTimeIn, scheduledTimeIn) ? "late" : "present"
  }

  const isTomorrow = dateStr === tomorrowStr
  if (isTomorrow) return "upcoming"

  const isFutureDate = dateStr > todayStr
  if (isFutureDate) return "no-schedule"

  const isPastDate = dateStr < todayStr
  if (isPastDate && startDateStr != null && dateStr >= startDateStr) return "absent"

  return "no-schedule"
}

export type DeriveStatusFromTimesInput = {
  timeIn: string | null
  timeOut: string | null
  scheduledTimeIn: string
}

/**
 * Derive stored status from time_in/time_out for API save.
 * incomplete = has time_in but no time_out
 * absent = no time_in and no time_out
 */
export function deriveStatusFromTimes(input: DeriveStatusFromTimesInput): "present" | "late" | "absent" | "incomplete" {
  const { timeIn, timeOut, scheduledTimeIn } = input
  const hasTimeIn = !!timeIn?.trim()
  const hasTimeOut = !!timeOut?.trim()

  if (!hasTimeIn && !hasTimeOut) return "absent"
  if (hasTimeIn && !hasTimeOut) return "incomplete"
  if (hasTimeIn && hasTimeOut) {
    return isLate(timeIn!, scheduledTimeIn) ? "late" : "present"
  }
  return "incomplete"
}
