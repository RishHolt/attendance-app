import { isLate } from "./time-calc"

export type AttendanceStatus = "present" | "late" | "absent" | "upcoming" | "no-schedule"

export type DeriveStatusInput = {
  hasSchedule: boolean
  hasTimeIn: boolean
  scheduledTimeIn: string
  actualTimeIn: string | null
  dateStr: string
  todayStr: string
  tomorrowStr: string
  startDateStr: string | null
}

export function deriveAttendanceStatus(input: DeriveStatusInput): AttendanceStatus {
  const {
    hasSchedule,
    hasTimeIn,
    scheduledTimeIn,
    actualTimeIn,
    dateStr,
    todayStr,
    tomorrowStr,
    startDateStr,
  } = input

  if (!hasSchedule) return "no-schedule"

  if (hasTimeIn && actualTimeIn) {
    return isLate(actualTimeIn, scheduledTimeIn) ? "late" : "present"
  }

  const isTomorrow = dateStr === tomorrowStr
  if (isTomorrow) return "upcoming"

  const isPastDate = dateStr < todayStr
  const isOnOrAfterStartDate = startDateStr == null || dateStr >= startDateStr
  if (isPastDate && isOnOrAfterStartDate) return "absent"

  if (dateStr >= todayStr) return "upcoming"
  return "no-schedule"
}
