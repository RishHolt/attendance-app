const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

type ScheduleLike = {
  day_of_week: number | null
  custom_date: string | null | undefined
}

/**
 * Builds a label like "Monday - Friday" from recurring weekly schedules.
 * Excludes Saturday (6) — that belongs in the Saturdays field on the form.
 */
export const formatRegularDaysFromSchedule = (scheduleRows: ScheduleLike[]): string => {
  const recurringDows = [
    ...new Set(
      scheduleRows
        .filter((r) => r.custom_date == null && r.day_of_week != null)
        .map((r) => r.day_of_week as number)
    ),
  ].sort((a, b) => a - b)

  /** Sun(0)–Fri(5); Saturday(6) is listed under “Saturdays” on the form */
  const regularDows = recurringDows.filter((d) => d >= 0 && d <= 5)

  if (regularDows.length === 0) return 'N/A'

  const names = regularDows.map((d) => DAY_NAMES[d])
  if (regularDows.length === 1) return names[0]

  let consecutive = true
  for (let i = 1; i < regularDows.length; i++) {
    if (regularDows[i] !== regularDows[i - 1] + 1) {
      consecutive = false
      break
    }
  }
  if (consecutive) return `${names[0]} - ${names[names.length - 1]}`
  return names.join(', ')
}
