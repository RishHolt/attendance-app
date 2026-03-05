/**
 * Returns default date range for admin reports: from 30 days ago to today (YYYY-MM-DD).
 */
export function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split("T")[0] ?? ""
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] ?? ""
  return { from, to }
}
