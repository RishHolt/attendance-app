import PizZip from 'pizzip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import path from 'path'
import fs from 'fs'
import { DTRData } from './types'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Half-points: 20 = 10pt — most filled DTR cells (Word `w:sz` uses half-points) */
const SZ_BODY = '18'
/** Half-points for the employee name (underlined, centered). */
const SZ_NAME = '20'
/** Half-points for the “Regular days” value (e.g. Monday - Friday). Change this to resize only that line. */
const SZ_REGULAR_DAYS = '18'
/** Half-points for attendance table header rows: Day, A.M., P.M., Undertime, Arrival, Departure, Hours, Minutes */
const SZ_ATTENDANCE_HEADER = '12'

const getAll = (node: Element, localName: string): Element[] => {
  const results: Element[] = []
  const walk = (n: Node) => {
    if (n.nodeType === 1) {
      const el = n as Element
      if (el.localName === localName) results.push(el)
      Array.from(el.childNodes).forEach(walk)
    }
  }
  walk(node)
  return results
}

const getDirectChildren = (node: Element, localName: string): Element[] => {
  const results: Element[] = []
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    if (child.nodeType === 1 && (child as Element).localName === localName) {
      results.push(child as Element)
    }
  }
  return results
}

const getDirectChildElements = (node: Element): Element[] => {
  const results: Element[] = []
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    if (child.nodeType === 1) results.push(child as Element)
  }
  return results
}

/** Template may include a trailing instruction page (image table) after the DTR table — omit from export. */
const removeInstructionPageAfterDtrTable = (body: Element) => {
  const children = getDirectChildElements(body)
  const sectPrIndex = children.findIndex((c) => c.localName === 'sectPr')
  if (sectPrIndex === -1) return
  const firstTblIndex = children.findIndex((c) => c.localName === 'tbl')
  if (firstTblIndex === -1) return
  for (let i = sectPrIndex - 1; i > firstTblIndex; i--) {
    const n = children[i]
    n.parentNode?.removeChild(n)
  }
}

const clearDirectRuns = (p: Element) => {
  getDirectChildren(p, 'r').forEach((r) => p.removeChild(r))
}

const buildArialRPr = (
  doc: Document,
  opts: { szHalf: string; bold?: boolean; underline?: boolean }
) => {
  const rPr = doc.createElementNS(W, 'w:rPr')
  const rFonts = doc.createElementNS(W, 'w:rFonts')
  rFonts.setAttributeNS(W, 'w:ascii', 'Arial')
  rFonts.setAttributeNS(W, 'w:hAnsi', 'Arial')
  rFonts.setAttributeNS(W, 'w:cs', 'Arial')
  rFonts.setAttributeNS(W, 'w:eastAsia', 'Arial')
  rPr.appendChild(rFonts)
  if (opts.bold) {
    rPr.appendChild(doc.createElementNS(W, 'w:b'))
    rPr.appendChild(doc.createElementNS(W, 'w:bCs'))
  }
  if (opts.underline) {
    const u = doc.createElementNS(W, 'w:u')
    u.setAttributeNS(W, 'w:val', 'single')
    rPr.appendChild(u)
  }
  const sz = doc.createElementNS(W, 'w:sz')
  sz.setAttributeNS(W, 'w:val', opts.szHalf)
  rPr.appendChild(sz)
  const szCs = doc.createElementNS(W, 'w:szCs')
  szCs.setAttributeNS(W, 'w:val', opts.szHalf)
  rPr.appendChild(szCs)
  return rPr
}

const appendArialTextRun = (
  p: Element,
  text: string,
  doc: Document,
  opts: { szHalf: string; bold?: boolean; underline?: boolean }
) => {
  const r = doc.createElementNS(W, 'w:r')
  r.appendChild(buildArialRPr(doc, { ...opts, szHalf: opts.szHalf }))
  const t = doc.createElementNS(W, 'w:t')
  if (text !== '' && (/^\s/.test(text) || /\s$/.test(text))) {
    t.setAttribute('xml:space', 'preserve')
  }
  t.textContent = text
  r.appendChild(t)
  p.appendChild(r)
}

const setRunFontSizeHalfPoints = (r: Element, szHalf: string, doc: Document) => {
  let rPr = getDirectChildren(r, 'rPr')[0]
  if (!rPr) {
    rPr = doc.createElementNS(W, 'w:rPr')
    r.insertBefore(rPr, r.firstChild)
  }
  let sz = getDirectChildren(rPr, 'sz')[0]
  if (!sz) {
    sz = doc.createElementNS(W, 'w:sz')
    rPr.appendChild(sz)
  }
  sz.setAttributeNS(W, 'w:val', szHalf)
  let szCs = getDirectChildren(rPr, 'szCs')[0]
  if (!szCs) {
    szCs = doc.createElementNS(W, 'w:szCs')
    rPr.appendChild(szCs)
  }
  szCs.setAttributeNS(W, 'w:val', szHalf)
}

/** First two rows of `tables[1]`: main headers + sub-headers (template layout). */
const applyAttendanceHeaderFontSize = (attTable: Element, szHalf: string, doc: Document) => {
  const rows = getDirectChildren(attTable, 'tr')
  for (let rowIdx = 0; rowIdx < 2 && rowIdx < rows.length; rowIdx++) {
    const cells = getDirectChildren(rows[rowIdx], 'tc')
    cells.forEach((tc) => {
      getAll(tc, 'r').forEach((r) => setRunFontSizeHalfPoints(r, szHalf, doc))
    })
  }
}

const ensureParagraphJcLeft = (p: Element, doc: Document) => {
  let pPr = getDirectChildren(p, 'pPr')[0]
  if (!pPr) {
    pPr = doc.createElementNS(W, 'w:pPr')
    p.insertBefore(pPr, p.firstChild)
  }
  let jc = getDirectChildren(pPr, 'jc')[0]
  if (!jc) {
    jc = doc.createElementNS(W, 'w:jc')
    pPr.appendChild(jc)
  }
  jc.setAttributeNS(W, 'w:val', 'left')
}

/** Replace all runs in the first paragraph of a table cell with one Arial run (same size everywhere). */
const setCellTextArial = (
  tc: Element,
  value: string,
  doc: Document,
  opts: { bold?: boolean; underline?: boolean; szHalf?: string } = {}
) => {
  let p = getDirectChildren(tc, 'p')[0]
  if (!p) {
    p = doc.createElementNS(W, 'w:p')
    tc.appendChild(p)
  }
  clearDirectRuns(p)
  ensureParagraphJcLeft(p, doc)
  const szHalf = opts.szHalf ?? SZ_BODY
  appendArialTextRun(p, value, doc, {
    szHalf,
    bold: opts.bold,
    underline: opts.underline,
  })
}

const ensureTableJc = (tbl: Element, val: 'left' | 'right' | 'center', doc: Document) => {
  let tblPr = getDirectChildren(tbl, 'tblPr')[0]
  if (!tblPr) {
    tblPr = doc.createElementNS(W, 'w:tblPr')
    tbl.insertBefore(tblPr, tbl.firstChild)
  }
  let jc = getDirectChildren(tblPr, 'jc')[0]
  if (!jc) {
    jc = doc.createElementNS(W, 'w:jc')
    tblPr.appendChild(jc)
  }
  jc.setAttributeNS(W, 'w:val', val)
}

const ensureTcW = (cell: Element, widthStr: string, doc: Document) => {
  let tcPr = getDirectChildren(cell, 'tcPr')[0]
  if (!tcPr) {
    tcPr = doc.createElementNS(W, 'w:tcPr')
    cell.insertBefore(tcPr, cell.firstChild)
  }
  let tcW = getDirectChildren(tcPr, 'tcW')[0]
  if (!tcW) {
    tcW = doc.createElementNS(W, 'w:tcW')
    tcPr.appendChild(tcW)
  }
  tcW.setAttributeNS(W, 'w:w', widthStr)
  tcW.setAttributeNS(W, 'w:type', 'dxa')
}

const fillCell = (cell: Element, data: DTRData, doc: Document) => {
  const records = new Map(data.records.map((r) => [r.day, r]))

  const allParas = getAll(cell, 'p')
  for (let i = 0; i < allParas.length; i++) {
    const text = getAll(allParas[i], 't')
      .map((t) => t.textContent ?? '')
      .join('')
    if (text.includes('(Name)') && i > 0) {
      const namePara = allParas[i - 1]

      let pPr = getAll(namePara, 'pPr')[0]
      if (!pPr) {
        pPr = doc.createElementNS(W, 'w:pPr')
        namePara.insertBefore(pPr, namePara.firstChild)
      }
      let jc = getAll(pPr, 'jc')[0]
      if (!jc) {
        jc = doc.createElementNS(W, 'w:jc')
        pPr.appendChild(jc)
      }
      jc.setAttributeNS(W, 'w:val', 'center')

      clearDirectRuns(namePara)
      appendArialTextRun(namePara, data.name, doc, {
        szHalf: SZ_NAME,
        bold: true,
        underline: true,
      })
      break
    }
  }

  const tables = getDirectChildren(cell, 'tbl')
  const infoRows = getDirectChildren(tables[0], 'tr')
  setCellTextArial(getDirectChildren(infoRows[0], 'tc')[1], data.month, doc)
  setCellTextArial(getDirectChildren(infoRows[1], 'tc')[2], data.regular_days, doc, {
    szHalf: SZ_REGULAR_DAYS,
  })
  setCellTextArial(getDirectChildren(infoRows[2], 'tc')[2], data.saturdays, doc)

  const attTable = tables[1]
  applyAttendanceHeaderFontSize(attTable, SZ_ATTENDANCE_HEADER, doc)

  const attRows = getDirectChildren(attTable, 'tr')
  for (let day = 1; day <= 31; day++) {
    const row = attRows[day + 1]
    if (!row) continue
    const rec = records.get(day)
    const cells = getDirectChildren(row, 'tc')
    setCellTextArial(cells[1], rec?.am_arrival ?? '', doc)
    setCellTextArial(cells[2], rec?.am_departure ?? '', doc)
    setCellTextArial(cells[3], rec?.pm_arrival ?? '', doc)
    setCellTextArial(cells[4], rec?.pm_departure ?? '', doc)
    setCellTextArial(cells[5], rec?.undertime_hours ?? '', doc)
    setCellTextArial(cells[6], rec?.undertime_minutes ?? '', doc)
  }

  const totalCells = getDirectChildren(attRows[33], 'tc')
  setCellTextArial(totalCells[1], data.total_work_hours, doc)
  setCellTextArial(totalCells[2], data.total_work_minutes, doc)
}

const fixOuterTable = (body: Element, doc: Document) => {
  const CONTENT_W = 10546
  const CELL_W = Math.floor(CONTENT_W / 2)
  /** Space between the two DTR columns (twips); keeps total row width = CONTENT_W */
  const GAP = 800
  const COL_W = Math.floor((CONTENT_W - GAP) / 2)

  const outerTbl = getAll(body, 'tbl')[0]
  if (!outerTbl) return

  const tblPr = getDirectChildren(outerTbl, 'tblPr')[0]
  if (tblPr) {
    const tblW = getDirectChildren(tblPr, 'tblW')[0]
    if (tblW) tblW.setAttributeNS(W, 'w:w', String(CONTENT_W))
    const jc = getDirectChildren(tblPr, 'jc')[0]
    if (jc) jc.parentNode?.removeChild(jc)
  }

  const outerRow = getDirectChildren(outerTbl, 'tr')[0]
  if (!outerRow) return

  const tblGrid = getDirectChildren(outerTbl, 'tblGrid')[0]
  const outerCells = getDirectChildren(outerRow, 'tc')
  let gridCols = tblGrid ? getDirectChildren(tblGrid, 'gridCol') : []

  if (outerCells.length === 2 && tblGrid && gridCols.length === 2) {
    gridCols[0].setAttributeNS(W, 'w:w', String(COL_W))
    const gapCol = doc.createElementNS(W, 'w:gridCol')
    gapCol.setAttributeNS(W, 'w:w', String(GAP))
    tblGrid.insertBefore(gapCol, gridCols[1])
    gridCols = getDirectChildren(tblGrid, 'gridCol')
    gridCols[2].setAttributeNS(W, 'w:w', String(COL_W))

    const gapTc = doc.createElementNS(W, 'w:tc')
    const gapTcPr = doc.createElementNS(W, 'w:tcPr')
    const gapTcW = doc.createElementNS(W, 'w:tcW')
    gapTcW.setAttributeNS(W, 'w:w', String(GAP))
    gapTcW.setAttributeNS(W, 'w:type', 'dxa')
    gapTcPr.appendChild(gapTcW)
    gapTc.appendChild(gapTcPr)
    gapTc.appendChild(doc.createElementNS(W, 'w:p'))
    outerRow.insertBefore(gapTc, outerCells[1])
  } else if (tblGrid && gridCols.length === 2) {
    gridCols.forEach((col) => col.setAttributeNS(W, 'w:w', String(CELL_W)))
  }

  const cellsFinal = getDirectChildren(outerRow, 'tc')
  const widthsFinal = tblGrid ? getDirectChildren(tblGrid, 'gridCol') : []

  for (let i = 0; i < cellsFinal.length && i < widthsFinal.length; i++) {
    const w = widthsFinal[i].getAttributeNS(W, 'w:w')
    if (w) ensureTcW(cellsFinal[i], w, doc)
  }

  /** Both DTR tables stay left-aligned in their cells. Right `w:jc` on the 2nd table made “For the month of…” look centered in Word/preview; spacing comes from the gap column. */
  cellsFinal.forEach((cell) => {
    getDirectChildren(cell, 'tbl').forEach((tbl) => ensureTableJc(tbl, 'left', doc))
  })
}

/** One DTR column only (preview): remove duplicate side and full-width the remaining cell */
const fixOuterTableSingleColumn = (body: Element) => {
  const CONTENT_W = 10546
  const outerTbl = getAll(body, 'tbl')[0]
  if (!outerTbl) return

  const tblPr = getDirectChildren(outerTbl, 'tblPr')[0]
  if (tblPr) {
    const tblW = getDirectChildren(tblPr, 'tblW')[0]
    if (tblW) tblW.setAttributeNS(W, 'w:w', String(CONTENT_W))
    const jc = getDirectChildren(tblPr, 'jc')[0]
    if (jc) jc.parentNode?.removeChild(jc)
  }

  const tblGrid = getDirectChildren(outerTbl, 'tblGrid')[0]
  if (tblGrid) {
    const cols = getDirectChildren(tblGrid, 'gridCol')
    if (cols.length >= 2) {
      cols[1].parentNode?.removeChild(cols[1])
    }
    const firstCol = getDirectChildren(tblGrid, 'gridCol')[0]
    if (firstCol) firstCol.setAttributeNS(W, 'w:w', String(CONTENT_W))
  }

  const outerRow = getDirectChildren(outerTbl, 'tr')[0]
  if (!outerRow) return
  const tcs = getDirectChildren(outerRow, 'tc')
  if (tcs.length >= 2) {
    tcs[1].parentNode?.removeChild(tcs[1])
  }
  const left = getDirectChildren(outerRow, 'tc')[0]
  if (left) {
    const tcPr = getDirectChildren(left, 'tcPr')[0]
    if (tcPr) {
      const tcW = getDirectChildren(tcPr, 'tcW')[0]
      if (tcW) tcW.setAttributeNS(W, 'w:w', String(CONTENT_W))
    }
  }
}

export type GenerateDTROptions = {
  /** Single filled column (for preview); export uses two copies per form */
  singleColumn?: boolean
}

export const generateDTR = async (
  data: DTRData,
  options?: GenerateDTROptions
): Promise<Buffer> => {
  const singleColumn = options?.singleColumn === true
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'DTR-template.docx')
  const templateBuf = fs.readFileSync(templatePath)

  const zip = new PizZip(templateBuf)
  const xmlStr = zip.file('word/document.xml')!.asText()

  const parser = new DOMParser()
  const serializer = new XMLSerializer()
  const doc = parser.parseFromString(xmlStr, 'text/xml')
  const root = doc.documentElement

  const body = getAll(root, 'body')[0]
  const outerTbl = getDirectChildren(body, 'tbl')[0]
  const outerRow = getDirectChildren(outerTbl, 'tr')[0]
  const cells = getDirectChildren(outerRow, 'tc')
  const leftCell = cells[0]
  const rightCell = cells[1]

  if (singleColumn) {
    fillCell(leftCell, data, doc)
    fixOuterTableSingleColumn(root)
  } else {
    const leftClone = leftCell.cloneNode(true) as Element
    rightCell.parentNode?.replaceChild(leftClone, rightCell)

    const freshOuterRow = getDirectChildren(outerTbl, 'tr')[0]
    const newCells = getDirectChildren(freshOuterRow, 'tc')
    fillCell(newCells[0], data, doc)
    fillCell(newCells[1], data, doc)

    fixOuterTable(root, doc)
  }

  removeInstructionPageAfterDtrTable(body)

  zip.file('word/document.xml', serializer.serializeToString(doc))
  return Buffer.from(zip.generate({ type: 'arraybuffer' }))
}
