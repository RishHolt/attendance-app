/** Strip characters invalid in common filesystems */
const sanitizeFileNameSegment = (s: string) =>
  s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** e.g. "March 2026" → "March, 2026" */
export const formatMonthYearComma = (monthLabel: string) => {
  const t = monthLabel.trim()
  if (t.includes(',')) return t
  const m = t.match(/^(.+?)\s+(\d{4})$/)
  if (m) return `${m[1].trim()}, ${m[2]}`
  return t
}

/** `(Full Name) - March, 2026` — base name without `.docx` */
export const buildDtrExportFileBaseName = (fullName: string, monthLabel: string) => {
  const name = sanitizeFileNameSegment(fullName) || 'Name'
  const my = formatMonthYearComma(monthLabel)
  return `(${name}) - ${my}`
}
