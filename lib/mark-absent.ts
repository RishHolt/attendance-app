/**
 * Pure business logic for auto-absent marking.
 * Separated from the route so it can be unit-tested without Supabase.
 */

/**
 * Returns true if targetDate is in the future relative to todayISO.
 */
export function isFutureDate(targetDate: string, todayISO: string): boolean {
  return targetDate > todayISO
}

/**
 * Returns the JS day-of-week (0=Sun … 6=Sat) for a YYYY-MM-DD date string.
 * Uses noon to avoid DST boundary issues.
 */
export function getDayOfWeek(dateISO: string): number {
  return new Date(dateISO + "T12:00:00").getDay()
}

type ScheduleEntry = {
  user_id: string
  day_of_week: number | null
  custom_date: string | null
  time_out: string // "HH:MM" or "HH:MM:SS" from DB
}

type ExistingRecord = {
  user_id: string
}

/**
 * Determines which user IDs should be marked absent for targetDate.
 *
 * Rules:
 * - Only users in activeUserIds are considered
 * - A user must have a schedule on targetDate (recurring day-of-week OR exact custom_date)
 * - A user must NOT already have an attendance record on targetDate
 * - When nowTime is provided (today): only mark users whose latest scheduled time_out has passed
 * - When nowTime is null (past date): no time check — all unrecorded scheduled users are marked
 *
 * @param nowTime Current time as "HH:MM". Pass null for past dates (no time restriction).
 */
export function resolveAbsentUserIds(
  activeUserIds: string[],
  schedules: ScheduleEntry[],
  existingRecords: ExistingRecord[],
  targetDate: string,
  nowTime: string | null,
): string[] {
  const dayOfWeek = getDayOfWeek(targetDate)
  const activeSet = new Set(activeUserIds)
  const alreadyRecorded = new Set(existingRecords.map((r) => r.user_id))

  // Build map: user_id → latest time_out (HH:MM) among matching schedules
  const latestTimeOut = new Map<string, string>()

  for (const s of schedules) {
    if (!activeSet.has(s.user_id)) continue
    const matches =
      (s.day_of_week !== null && s.day_of_week === dayOfWeek) ||
      (s.custom_date !== null && s.custom_date === targetDate)
    if (!matches) continue

    const timeOut = s.time_out.slice(0, 5) // normalise "HH:MM:SS" → "HH:MM"
    const current = latestTimeOut.get(s.user_id)
    if (current === undefined || timeOut > current) {
      latestTimeOut.set(s.user_id, timeOut)
    }
  }

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }

  const result: string[] = []
  for (const [userId, timeOut] of latestTimeOut) {
    if (alreadyRecorded.has(userId)) continue
    // For today: only mark absent after their shift has ended
    if (nowTime !== null && toMinutes(nowTime) < toMinutes(timeOut)) continue
    result.push(userId)
  }
  return result
}
