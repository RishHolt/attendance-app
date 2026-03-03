import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

export type AttendanceExportRow = {
  dateDisplay: string
  timeIn: string
  timeOut: string
  status: string
  total: string
  totalMinutes: number
}

export type ExportSummary = {
  totalHours: number
  totalOvertime: number
  totalPresent: number
  totalLate: number
  totalAbsent: number
  totalIncomplete?: number
}

export type ExportAttendanceInput = {
  userName: string
  periodLabel: string
  rows: AttendanceExportRow[]
  summary: ExportSummary
  supervisorName: string
  supervisorPosition: string
}

const formatMinutesAsHours = (minutes: number): string => {
  if (minutes <= 0) return "0h"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export async function generateCalendarPdf(input: ExportAttendanceInput): Promise<Uint8Array> {
  const { userName, periodLabel, rows, summary, supervisorName, supervisorPosition } = input
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595
  const pageHeight = 842
  const margin = 48
  const contentWidth = pageWidth - margin * 2

  const cols = ["Date", "Time In", "Time Out", "Status", "Total"]
  const colWeights = [0.30, 0.16, 0.16, 0.22, 0.16]
  const colWidths = colWeights.map((w) => Math.round(contentWidth * w))
  const rowHeight = 22
  const headerHeight = 28
  const cellPadding = 8

  const page = pdfDoc.addPage([pageWidth, pageHeight])
  const { height } = page.getSize()

  const zinc = {
    50: rgb(0.98, 0.98, 0.98),
    100: rgb(0.96, 0.96, 0.96),
    200: rgb(0.88, 0.88, 0.9),
    400: rgb(0.55, 0.55, 0.6),
    500: rgb(0.45, 0.45, 0.5),
    700: rgb(0.28, 0.28, 0.32),
    900: rgb(0.12, 0.12, 0.15),
  }

  let y = height - margin

  page.drawText("Attendance Report", {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: zinc[900],
  })
  y -= 28

  page.drawText(userName, {
    x: margin,
    y,
    size: 11,
    font: boldFont,
    color: zinc[900],
  })
  y -= 14

  page.drawText(periodLabel, {
    x: margin,
    y,
    size: 10,
    font,
    color: zinc[500],
  })
  y -= 32

  const tableStartY = y

  page.drawRectangle({
    x: margin,
    y: tableStartY - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: zinc[100],
  })
  page.drawLine({
    start: { x: margin, y: tableStartY - headerHeight },
    end: { x: margin + contentWidth, y: tableStartY - headerHeight },
    thickness: 0.5,
    color: zinc[200],
  })

  let colX = margin
  for (let c = 0; c < cols.length; c++) {
    page.drawText(cols[c], {
      x: colX + cellPadding,
      y: tableStartY - headerHeight + 9,
      size: 8,
      font: boldFont,
      color: zinc[700],
    })
    colX += colWidths[c]
  }

  const dataStartY = tableStartY - headerHeight
  const rowsPerPage = Math.floor((dataStartY - margin) / rowHeight)
  let currentPage = page
  let currentDataStartY = dataStartY
  let rowsOnCurrentPage = 0

  const drawTableHeader = (p: ReturnType<typeof pdfDoc.addPage>, startY: number) => {
    p.drawRectangle({
      x: margin,
      y: startY - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: zinc[100],
    })
    p.drawLine({
      start: { x: margin, y: startY - headerHeight },
      end: { x: margin + contentWidth, y: startY - headerHeight },
      thickness: 0.5,
      color: zinc[200],
    })
    let cx = margin
    for (let c = 0; c < cols.length; c++) {
      p.drawText(cols[c], {
        x: cx + cellPadding,
        y: startY - headerHeight + 9,
        size: 8,
        font: boldFont,
        color: zinc[700],
      })
      cx += colWidths[c]
    }
  }

  const truncate = (text: string, maxChars: number) =>
    String(text).length > maxChars ? String(text).slice(0, maxChars - 1) + "…" : String(text)

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (rowsOnCurrentPage >= rowsPerPage) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      currentDataStartY = pageHeight - margin - headerHeight
      drawTableHeader(currentPage, pageHeight - margin)
      rowsOnCurrentPage = 0
    }
    const drawY = currentDataStartY - (rowsOnCurrentPage + 1) * rowHeight

    const maxCharsByCol = [28, 12, 12, 16, 14]
    const cells = [
      truncate(row.dateDisplay, maxCharsByCol[0]),
      truncate(row.timeIn || "—", maxCharsByCol[1]),
      truncate(row.timeOut || "—", maxCharsByCol[2]),
      truncate(row.status, maxCharsByCol[3]),
      truncate(row.total || "—", maxCharsByCol[4]),
    ]
    let cx = margin
    for (let c = 0; c < cells.length; c++) {
      currentPage.drawText(cells[c], {
        x: cx + cellPadding,
        y: drawY + (rowHeight - 8) / 2 + 2,
        size: 8,
        font,
        color: zinc[900],
      })
      cx += colWidths[c]
    }

    currentPage.drawLine({
      start: { x: margin, y: drawY },
      end: { x: margin + contentWidth, y: drawY },
      thickness: 0.25,
      color: zinc[200],
    })
    rowsOnCurrentPage++
  }

  const drawColumnBorders = (p: ReturnType<typeof pdfDoc.addPage>, topY: number, bottomY: number) => {
    let x = margin
    for (let c = 0; c <= colWidths.length; c++) {
      p.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY },
        thickness: 0.25,
        color: zinc[200],
      })
      if (c < colWidths.length) x += colWidths[c]
    }
  }

  const rowsOnFirstPage = Math.min(rows.length, rowsPerPage)
  drawColumnBorders(page, tableStartY, dataStartY - rowsOnFirstPage * rowHeight)
  if (currentPage !== page) {
    const contTop = pageHeight - margin
    const contBottom = currentDataStartY - rowsOnCurrentPage * rowHeight
    drawColumnBorders(currentPage, contTop, contBottom)
  }

  const summaryPage = currentPage
  const rowsOnLastPage = rowsOnCurrentPage
  let summaryY = currentDataStartY - (rowsOnLastPage + 1) * rowHeight - 36

  if (summaryY < margin + 160) {
    const newPage = pdfDoc.addPage([pageWidth, pageHeight])
    summaryY = pageHeight - margin
    currentPage = newPage
  } else {
    currentPage = summaryPage
  }

  currentPage.drawText("Summary", {
    x: margin,
    y: summaryY,
    size: 9,
    font: boldFont,
    color: zinc[700],
  })
  summaryY -= 18

  currentPage.drawText(
    `Regular: ${formatMinutesAsHours(summary.totalHours)}${summary.totalOvertime > 0 ? ` · Overtime: ${formatMinutesAsHours(summary.totalOvertime)}` : ""}`,
    { x: margin, y: summaryY, size: 9, font, color: zinc[500] }
  )
  summaryY -= 14
  const statusParts = [
    `Present ${summary.totalPresent}`,
    `Late ${summary.totalLate}`,
    `Absent ${summary.totalAbsent}`,
  ]
  if ((summary.totalIncomplete ?? 0) > 0) {
    statusParts.push(`Incomplete ${summary.totalIncomplete}`)
  }
  currentPage.drawText(statusParts.join("  ·  "), {
    x: margin,
    y: summaryY,
    size: 9,
    font,
    color: zinc[500],
  })
  summaryY -= 40

  const sigLineWidth = 180

  const drawSignatureBlock = (
    p: ReturnType<typeof pdfDoc.addPage>,
    x: number,
    y: number,
    name: string,
    position: string
  ) => {
    p.drawLine({
      start: { x, y },
      end: { x: x + sigLineWidth, y },
      thickness: 0.5,
      color: zinc[200],
    })
    p.drawText(name, {
      x,
      y: y - 20,
      size: 14,
      font: boldFont,
      color: zinc[900],
    })
    p.drawText(position, {
      x,
      y: y - 38,
      size: 10,
      font,
      color: zinc[500],
    })
  }

  currentPage.drawText("Signature Over Printed Name", {
    x: margin,
    y: summaryY,
    size: 8,
    font: boldFont,
    color: zinc[700],
  })
  summaryY -= 24

  drawSignatureBlock(currentPage, margin, summaryY, userName, "Employee")
  drawSignatureBlock(
    currentPage,
    margin + contentWidth / 2 + 16,
    summaryY,
    supervisorName,
    supervisorPosition
  )

  return pdfDoc.save()
}
