import PizZip from 'pizzip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import path from 'path'
import fs from 'fs'
import { DTRData } from './types'
import {
  type PageLayoutTwips,
  type PaperSizeId,
  DEFAULT_PAPER_SIZE,
  PAGE_LAYOUTS,
  getContentWidthTwips,
} from './paper'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Half-points: 20 = 10pt — most filled DTR cells (Word `w:sz` uses half-points) */
const SZ_BODY = '18'
/** Name/title block replacing "In Charge" in the DTR footer */
const IN_CHARGE_NAME = 'MARIE JEANNE CARMELLI R. DESIDERIO'
const IN_CHARGE_TITLE = 'Administrative Officer IV/HRMO II'
const SZ_IN_CHARGE = '16'
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

/**
 * The template’s first cell uses `tcMar` with right padding toward the gap. The second cell is a clone,
 * so the same right margin sits on the outer page edge — extra white space on the right vs the left.
 */
const stripTcMarFromCell = (tc: Element) => {
  const tcPr = getDirectChildren(tc, 'tcPr')[0]
  if (!tcPr) return
  const tcMar = getDirectChildren(tcPr, 'tcMar')[0]
  if (tcMar) tcMar.parentNode?.removeChild(tcMar)
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

const applySectionPageProperties = (body: Element, doc: Document, layout: PageLayoutTwips) => {
  const sectPr = getDirectChildren(body, 'sectPr')[0]
  if (!sectPr) return
  let pgSz = getDirectChildren(sectPr, 'pgSz')[0]
  if (!pgSz) {
    pgSz = doc.createElementNS(W, 'w:pgSz')
    sectPr.insertBefore(pgSz, sectPr.firstChild)
  }
  pgSz.setAttributeNS(W, 'w:w', String(layout.pgSzW))
  pgSz.setAttributeNS(W, 'w:h', String(layout.pgSzH))
  let pgMar = getDirectChildren(sectPr, 'pgMar')[0]
  if (!pgMar) {
    pgMar = doc.createElementNS(W, 'w:pgMar')
    sectPr.appendChild(pgMar)
  }
  pgMar.setAttributeNS(W, 'w:top', String(layout.pgMarTop))
  pgMar.setAttributeNS(W, 'w:right', String(layout.pgMarRight))
  pgMar.setAttributeNS(W, 'w:bottom', String(layout.pgMarBottom))
  pgMar.setAttributeNS(W, 'w:left', String(layout.pgMarLeft))
  pgMar.setAttributeNS(W, 'w:header', String(layout.header))
  pgMar.setAttributeNS(W, 'w:footer', String(layout.footer))
  pgMar.setAttributeNS(W, 'w:gutter', String(layout.gutter))
}

const fixOuterTable = (body: Element, doc: Document, contentWidthTwips: number) => {
  const CONTENT_W = contentWidthTwips
  const CELL_W = Math.floor(CONTENT_W / 2)
  /**
   * Must match `w:tblW` on the inner attendance table in `public/templates/DTR-template.docx`.
   * Row width is fixed; gap + both columns must fit. Raising GAP above (CONTENT_W - 2 * INNER_DTR_TABLE_W)
   * makes cells narrower than this table — Word/preview may ignore widths, so spacing changes look invisible.
   */
  const INNER_DTR_TABLE_W = 4823
  /** Space between the two DTR columns (twips); max ≈ CONTENT_W - 2 * INNER_DTR_TABLE_W */
  const GAP = 800
  /**
   * Horizontal placement of the whole outer table in the page content area (`w:jc` on outer `tblPr`).
   * `center` balances left/right space in the content area; `left` leaves more empty space on the right (default block layout).
   */
  const OUTER_TABLE_PAGE_ALIGN: 'left' | 'center' | 'right' = 'center'
  /**
   * Equal-width data columns keep left/right spacing around each DTR consistent. (Asymmetric widths
   * — e.g. wider left cell — pushed one form visually without matching the other.)
   * Needs COL_W >= INNER_DTR_TABLE_W; with default CONTENT_W/GAP, (10546-800)/2 = 4873.
   */
  const COL_W = Math.floor((CONTENT_W - GAP) / 2)

  const outerTbl = getAll(body, 'tbl')[0]
  if (!outerTbl) return

  const tblPr = getDirectChildren(outerTbl, 'tblPr')[0]
  if (tblPr) {
    const tblW = getDirectChildren(tblPr, 'tblW')[0]
    if (tblW) tblW.setAttributeNS(W, 'w:w', String(CONTENT_W))
  }
  ensureTableJc(outerTbl, OUTER_TABLE_PAGE_ALIGN, doc)

  const outerRow = getDirectChildren(outerTbl, 'tr')[0]
  if (!outerRow) return

  const trPr = getDirectChildren(outerRow, 'trPr')[0]
  if (trPr) {
    const trJc = getDirectChildren(trPr, 'jc')[0]
    if (trJc) trJc.parentNode?.removeChild(trJc)
  }

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

  /**
   * Clone of the first cell keeps `tcMar` with right padding; on the outer right edge that reads as
   * extra page margin. Strip only the last data cell (not the first — preserves gap-side padding on the left DTR).
   */
  const lastOuterCell = cellsFinal[cellsFinal.length - 1]
  if (lastOuterCell) stripTcMarFromCell(lastOuterCell)

  /**
   * Inner tables left in both cells so attendance blocks and footer paragraphs share the same cell origin.
   */
  cellsFinal.forEach((cell) => {
    getDirectChildren(cell, 'tbl').forEach((tbl) => ensureTableJc(tbl, 'left', doc))
  })
}

/** One DTR column only (preview): remove duplicate side and full-width the remaining cell */
const fixOuterTableSingleColumn = (body: Element, contentWidthTwips: number) => {
  const CONTENT_W = contentWidthTwips
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

/**
 * Finds every paragraph whose text content is exactly "In Charge" (case-insensitive)
 * and replaces it with:
 *   1. Name paragraph (bold, centered)
 *   2. The underscore line that was originally above "In Charge" (moved between name and title)
 *   3. Title paragraph (centered)
 */
const replaceInChargeParagraphs = (body: Element, doc: Document) => {
  const allParas = getAll(body, 'p')
  for (const p of allParas) {
    const text = getAll(p, 't')
      .map((t) => t.textContent ?? '')
      .join('')
      .trim()

    if (text.toLowerCase() !== 'in charge') continue

    const parent = p.parentNode
    if (!parent) continue

    // Find the preceding sibling paragraph (the underscores line)
    let prevSibling: Element | null = null
    let cur = p.previousSibling
    while (cur) {
      if (cur.nodeType === 1 && (cur as Element).localName === 'p') {
        prevSibling = cur as Element
        break
      }
      cur = cur.previousSibling
    }

    // Reuse the "In Charge" paragraph as the name paragraph (bold, centered)
    clearDirectRuns(p)
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
    jc.setAttributeNS(W, 'w:val', 'center')
    const existingNameSpacing = getDirectChildren(pPr, 'spacing')[0]
    if (existingNameSpacing) pPr.removeChild(existingNameSpacing)
    const nameSpacing = doc.createElementNS(W, 'w:spacing')
    nameSpacing.setAttributeNS(W, 'w:after', '0')
    pPr.appendChild(nameSpacing)
    appendArialTextRun(p, IN_CHARGE_NAME, doc, { szHalf: SZ_IN_CHARGE, bold: true, underline: true })

    // Build title paragraph (centered, not bold)
    const titleP = doc.createElementNS(W, 'w:p')
    const titlePPr = doc.createElementNS(W, 'w:pPr')
    const titleSpacing = doc.createElementNS(W, 'w:spacing')
    titleSpacing.setAttributeNS(W, 'w:before', '0')
    titleSpacing.setAttributeNS(W, 'w:after', '0')
    titlePPr.appendChild(titleSpacing)
    const titleJc = doc.createElementNS(W, 'w:jc')
    titleJc.setAttributeNS(W, 'w:val', 'center')
    titlePPr.appendChild(titleJc)
    titleP.appendChild(titlePPr)
    appendArialTextRun(titleP, IN_CHARGE_TITLE, doc, { szHalf: SZ_IN_CHARGE, bold: false })

    // Insert title after name paragraph
    parent.insertBefore(titleP, p.nextSibling)

    // Remove the old underscore line paragraph (no longer needed — name is underlined)
    if (prevSibling) {
      parent.removeChild(prevSibling)
    }
  }
}

export type GenerateDTROptions = {
  /** Single filled column (for preview); export uses two copies per form */
  singleColumn?: boolean
  /** Page size drives `sectPr` pgSz/pgMar and the outer table width (content area). */
  paperSize?: PaperSizeId
}

export const generateDTR = async (
  data: DTRData,
  options?: GenerateDTROptions
): Promise<Buffer> => {
  const singleColumn = options?.singleColumn === true
  const paperSize = options?.paperSize ?? DEFAULT_PAPER_SIZE
  const pageLayout = PAGE_LAYOUTS[paperSize]
  const contentWidthTwips = getContentWidthTwips(pageLayout)

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'DTR-template.docx')
  const templateBuf = fs.readFileSync(templatePath)

  const zip = new PizZip(templateBuf)
  const xmlStr = zip.file('word/document.xml')!.asText()

  const parser = new DOMParser()
  const serializer = new XMLSerializer()
  const doc = parser.parseFromString(xmlStr, 'text/xml')
  const root = doc.documentElement

  const body = getAll(root, 'body')[0]
  if (!body) throw new Error('Invalid DTR template: missing w:body')
  applySectionPageProperties(body, doc, pageLayout)

  const outerTbl = getDirectChildren(body, 'tbl')[0]
  if (!outerTbl) throw new Error('Invalid DTR template: missing outer table')
  const outerRow = getDirectChildren(outerTbl, 'tr')[0]
  if (!outerRow) throw new Error('Invalid DTR template: missing outer row')
  const cells = getDirectChildren(outerRow, 'tc')
  const leftCell = cells[0]
  const rightCell = cells[1]

  if (singleColumn) {
    fillCell(leftCell, data, doc)
    fixOuterTableSingleColumn(root, contentWidthTwips)
  } else {
    const leftClone = leftCell.cloneNode(true) as Element
    rightCell.parentNode?.replaceChild(leftClone, rightCell)

    const freshOuterRow = getDirectChildren(outerTbl, 'tr')[0]
    const newCells = getDirectChildren(freshOuterRow, 'tc')
    fillCell(newCells[0], data, doc)
    fillCell(newCells[1], data, doc)

    fixOuterTable(root, doc, contentWidthTwips)
  }

  removeInstructionPageAfterDtrTable(body)
  replaceInChargeParagraphs(body, doc)

  zip.file('word/document.xml', serializer.serializeToString(doc))
  return Buffer.from(zip.generate({ type: 'arraybuffer' }))
}
