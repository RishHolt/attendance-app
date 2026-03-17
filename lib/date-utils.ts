/**
 * Returns default date range for admin reports: from 30 days ago to today (YYYY-MM-DD).
 */
export function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()

  const pad = (n: number) => String(n).padStart(2, "0")

  const toYear = now.getFullYear()
  const toMonth = pad(now.getMonth() + 1)
  const toDay = pad(now.getDate())
  const to = `${toYear}-${toMonth}-${toDay}`

  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fromYear = fromDate.getFullYear()
  const fromMonth = pad(fromDate.getMonth() + 1)
  const fromDay = pad(fromDate.getDate())
  const from = `${fromYear}-${fromMonth}-${fromDay}`

  return { from, to }
}
