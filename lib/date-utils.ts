const pad = (n: number) => String(n).padStart(2, "0")

const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Returns default date range for admin reports: from 30 days ago to today (YYYY-MM-DD).
 */
export function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const to = toISO(now)
  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: toISO(fromDate), to }
}

/**
 * Returns the Mon–Sun date range of the ISO week containing the given date (default: today).
 */
export function getWeekDateRange(date?: Date): { from: string; to: string } {
  const d = date ? new Date(date) : new Date()
  // getDay(): 0 = Sun, 1 = Mon … 6 = Sat. Shift so Mon = 0.
  const dayOfWeek = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - dayOfWeek)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toISO(monday), to: toISO(sunday) }
}
