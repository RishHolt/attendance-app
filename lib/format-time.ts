/**
 * Normalizes a time value to 24-hour "HH:MM" format.
 * Handles HH:MM, HH:MM:SS, and null/undefined.
 */
export function formatTime24(v: string | null | undefined): string {
  if (v == null || v === "") return "00:00"
  const s = String(v)
  const parts = s.split(":")
  const h = (parts[0] ?? "00").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

/**
 * Converts 24-hour time string to 12-hour format (e.g. "8:00 AM", "5:30 PM").
 * Handles HH:MM, HH:MM:SS, and ISO date strings.
 */
export function formatTime12(v: string | null | undefined): string {
  if (v == null || v === "") return "12:00 AM"
  const s = String(v)
  let h = 0
  let m = 0
  const colonMatch = s.match(/(\d{1,2}):(\d{2})/)
  if (colonMatch) {
    h = parseInt(colonMatch[1], 10)
    m = parseInt(colonMatch[2], 10)
  }
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const ampm = h < 12 ? "AM" : "PM"
  const minStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`
  return `${hour12}${minStr} ${ampm}`
}
