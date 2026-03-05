import {
  parseTimeToMinutes,
  calcWorkMinutes as rawCalcWorkMinutes,
  formatMinutesAsHours,
  formatTotalWithOvertime,
} from "./time-calc"

export type AttendanceComputeInput = {
  actualTimeIn: string
  actualTimeOut: string
  scheduledTimeIn: string
  scheduledTimeOut: string
  breakDurationHours: number
}

export type AttendanceMetrics = {
  lateMinutes: number
  earlyMinutes: number
  workMinutes: number
  overtimeMinutes: number
  effectiveWorkMinutes: number
  scheduledWorkMinutes: number
}

/**
 * Late minutes: actual time-in minus scheduled time-in when late (> 1 hour grace).
 * Returns 0 if on time or early.
 */
export function calcLateMinutes(
  actualTimeIn: string,
  scheduledTimeIn: string,
  graceMinutes = 60
): number {
  const actualM = parseTimeToMinutes(actualTimeIn)
  const schedM = parseTimeToMinutes(scheduledTimeIn)
  const diff = actualM - schedM
  if (diff <= graceMinutes) return 0
  return diff
}

/**
 * Early minutes: scheduled time-in minus actual time-in when clocked in early.
 * Returns 0 if on time or late.
 */
export function calcEarlyMinutes(
  actualTimeIn: string,
  scheduledTimeIn: string
): number {
  const actualM = parseTimeToMinutes(actualTimeIn)
  const schedM = parseTimeToMinutes(scheduledTimeIn)
  if (actualM >= schedM) return 0
  return schedM - actualM
}

/**
 * Overtime minutes: work minutes exceeding scheduled work.
 */
export function calcOvertimeMinutes(
  actualWorkMinutes: number,
  scheduledWorkMinutes: number
): number {
  return Math.max(0, actualWorkMinutes - scheduledWorkMinutes)
}

/**
 * Effective work minutes: from max(scheduledStart, actualStart) to actualEnd minus break.
 * Early clock-in counts work from scheduled start.
 */
export function calcEffectiveWorkMinutes(
  actualTimeIn: string,
  actualTimeOut: string,
  scheduledTimeIn: string,
  breakDurationHours: number
): number {
  const actualInM = parseTimeToMinutes(actualTimeIn)
  const actualOutM = parseTimeToMinutes(actualTimeOut)
  const schedInM = parseTimeToMinutes(scheduledTimeIn)
  const effectiveStart = Math.max(actualInM, schedInM)
  const raw = actualOutM - effectiveStart
  const breakM = Math.round((breakDurationHours ?? 0) * 60)
  return Math.max(0, raw - breakM)
}

/**
 * Raw work minutes: (timeOut - timeIn) - break. Re-export for convenience.
 */
export function calcWorkMinutes(
  timeIn: string,
  timeOut: string,
  breakDurationHours: number
): number {
  return rawCalcWorkMinutes(timeIn, timeOut, breakDurationHours)
}

/**
 * Compute all attendance metrics (late, early, work, overtime).
 */
export function computeAttendanceMetrics(input: AttendanceComputeInput): AttendanceMetrics {
  const {
    actualTimeIn,
    actualTimeOut,
    scheduledTimeIn,
    scheduledTimeOut,
    breakDurationHours,
  } = input

  const lateMinutes = calcLateMinutes(actualTimeIn, scheduledTimeIn)
  const earlyMinutes = calcEarlyMinutes(actualTimeIn, scheduledTimeIn)
  const workMinutes = rawCalcWorkMinutes(
    actualTimeIn,
    actualTimeOut,
    breakDurationHours
  )
  const effectiveWorkMinutes = calcEffectiveWorkMinutes(
    actualTimeIn,
    actualTimeOut,
    scheduledTimeIn,
    breakDurationHours
  )
  const scheduledWorkMinutes = rawCalcWorkMinutes(
    scheduledTimeIn,
    scheduledTimeOut,
    breakDurationHours
  )
  const overtimeMinutes = calcOvertimeMinutes(
    effectiveWorkMinutes,
    scheduledWorkMinutes
  )

  return {
    lateMinutes,
    earlyMinutes,
    workMinutes,
    overtimeMinutes,
    effectiveWorkMinutes,
    scheduledWorkMinutes,
  }
}

export { formatMinutesAsHours, formatTotalWithOvertime }
