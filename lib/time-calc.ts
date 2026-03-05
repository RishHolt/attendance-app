/**
 * Parse "HH:MM" or "H:MM" to minutes since midnight
 */
export function parseTimeToMinutes(t: string | null | undefined): number {
  if (!t?.trim()) return 0
  const parts = String(t).trim().split(":")
  const h = parseInt(parts[0] ?? "0", 10)
  const m = parseInt(parts[1] ?? "0", 10)
  return h * 60 + m
}

/**
 * Minutes since midnight to "Xh Ym" or "Xh"
 */
export function formatMinutesAsHours(minutes: number): string {
  if (minutes <= 0) return "0h"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Format hours with optional overtime. Regular is capped at scheduled;
 * any excess is shown as overtime. E.g. "8h" or "8h (+2h OT)"
 */
export function formatTotalWithOvertime(
  totalMinutes: number,
  scheduledMinutes: number
): string {
  const regularM = Math.min(totalMinutes, scheduledMinutes)
  const overtimeM = Math.max(0, totalMinutes - scheduledMinutes)
  const regular = formatMinutesAsHours(regularM)
  if (overtimeM <= 0) return regular
  return `${regular} (+${formatMinutesAsHours(overtimeM)} OT)`
}

/**
 * Total work minutes = (timeOut - timeIn) - breakDurationHours * 60
 */
export function calcWorkMinutes(
  timeIn: string,
  timeOut: string,
  breakDurationHours: number
): number {
  const inM = parseTimeToMinutes(timeIn)
  const outM = parseTimeToMinutes(timeOut)
  const raw = outM - inM
  const breakM = Math.round((breakDurationHours ?? 0) * 60)
  return Math.max(0, raw - breakM)
}

/**
 * Late if actual time-in is more than 1 hour (60 minutes) after scheduled time-in
 */
export function isLate(actualTimeIn: string, scheduledTimeIn: string): boolean {
  const actualM = parseTimeToMinutes(actualTimeIn)
  const schedM = parseTimeToMinutes(scheduledTimeIn)
  return actualM - schedM > 60
}
