# DTR Generator — Next.js Integration Guide
> Stack: Next.js 14 (App Router) · Vercel · Prisma/Supabase · No Python

---

## How It Works

```
Browser → POST /api/dtr/export
            ↓
        Load DTR-template.docx (Buffer)
        Unzip with PizZip → get word/document.xml
        Parse XML → inject employee data
        Rezip → return as .docx download
```

No Python. No native binaries. Runs on Vercel Node runtime.

---

## 1. Project Structure

```
your-nextjs-project/
├── app/
│   └── api/
│       └── dtr/
│           └── export/
│               └── route.ts          ← API route
├── lib/
│   └── dtr/
│       ├── generator.ts              ← Core XML manipulation
│       └── types.ts                  ← DTR data types
├── components/
│   └── DTRExportButton.tsx           ← Download button
└── public/
    └── templates/
        └── DTR-template.docx         ← Your adjusted template
```

---

## 2. Install Dependencies

```bash
npm install pizzip @xmldom/xmldom
```

Both are pure JS — no native binaries, works on Vercel.

---

## 3. Types — `lib/dtr/types.ts`

```typescript
export interface DTRRecord {
  day: number
  am_arrival: string
  am_departure: string
  pm_arrival: string
  pm_departure: string
  undertime_hours: string
  undertime_minutes: string
}

export interface DTRData {
  name: string
  month: string
  regular_days: string
  saturdays: string
  total_undertime_hours: string
  total_undertime_minutes: string
  records: DTRRecord[]
}
```

---

## 4. Core Generator — `lib/dtr/generator.ts`

```typescript
import PizZip from 'pizzip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import path from 'path'
import fs from 'fs'
import { DTRData } from './types'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

// ── XML helpers ──────────────────────────────────────────────────────────────

function getAll(node: Element, localName: string): Element[] {
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

function setFirstText(node: Element, value: string) {
  const t = getAll(node, 't')[0]
  if (t) t.textContent = value
}

function setOrCreateText(tc: Element, value: string, doc: Document) {
  const t = getAll(tc, 't')[0]
  if (t) {
    t.textContent = value
  } else {
    const p = getAll(tc, 'p')[0]
    if (p) {
      const r = doc.createElementNS(W, 'w:r')
      const t2 = doc.createElementNS(W, 'w:t')
      t2.textContent = value
      r.appendChild(t2)
      p.appendChild(r)
    }
  }
}

// ── Fill one DTR cell ────────────────────────────────────────────────────────

function fillCell(cell: Element, data: DTRData, doc: Document) {
  const records = new Map(data.records.map(r => [r.day, r]))

  // Name
  const allParas = getAll(cell, 'p')
  for (let i = 0; i < allParas.length; i++) {
    const text = getAll(allParas[i], 't').map(t => t.textContent ?? '').join('')
    if (text.includes('(Name)') && i > 0) {
      const namePara = allParas[i - 1]

      // Ensure centered
      let pPr = getAll(namePara, 'pPr')[0]
      if (!pPr) {
        pPr = doc.createElementNS(W, 'w:pPr')
        namePara.insertBefore(pPr, namePara.firstChild)
      }
      let jc = getAll(pPr, 'jc')[0]
      if (!jc) { jc = doc.createElementNS(W, 'w:jc'); pPr.appendChild(jc) }
      jc.setAttributeNS(W, 'w:val', 'center')

      // Clear old runs, write name
      getAll(namePara, 'r').forEach(r => r.parentNode?.removeChild(r))
      const r   = doc.createElementNS(W, 'w:r')
      const rPr = doc.createElementNS(W, 'w:rPr')
      const fnt = doc.createElementNS(W, 'w:rFonts')
      fnt.setAttributeNS(W, 'w:ascii', 'Arial')
      fnt.setAttributeNS(W, 'w:hAnsi', 'Arial')
      fnt.setAttributeNS(W, 'w:cs',    'Arial')
      rPr.appendChild(fnt)
      const b  = doc.createElementNS(W, 'w:b');  rPr.appendChild(b)
      const sz = doc.createElementNS(W, 'w:sz'); sz.setAttributeNS(W, 'w:val', '18'); rPr.appendChild(sz)
      const u  = doc.createElementNS(W, 'w:u');  u.setAttributeNS(W, 'w:val', 'single'); rPr.appendChild(u)
      r.appendChild(rPr)
      const t = doc.createElementNS(W, 'w:t')
      t.setAttribute('xml:space', 'preserve')
      t.textContent = data.name
      r.appendChild(t)
      namePara.appendChild(r)
      break
    }
  }

  // Info table: month, regular days, saturdays
  const tables = getAll(cell, 'tbl')
  const infoRows = getAll(tables[0], 'tr')
  setFirstText(getAll(infoRows[0], 'tc')[1], data.month)
  setFirstText(getAll(infoRows[1], 'tc')[2], data.regular_days)
  setFirstText(getAll(infoRows[2], 'tc')[2], data.saturdays)

  // Attendance table
  const attRows = getAll(tables[1], 'tr')
  for (let day = 1; day <= 31; day++) {
    const row   = attRows[day + 1]
    if (!row) continue
    const rec   = records.get(day)
    const cells = getAll(row, 'tc')
    setOrCreateText(cells[1], rec?.am_arrival   ?? '', doc)
    setOrCreateText(cells[2], rec?.am_departure ?? '', doc)
    setOrCreateText(cells[3], rec?.pm_arrival   ?? '', doc)
    setOrCreateText(cells[4], rec?.pm_departure ?? '', doc)
    setOrCreateText(cells[5], rec?.undertime_hours    ?? '', doc)
    setOrCreateText(cells[6], rec?.undertime_minutes  ?? '', doc)
  }

  // Total row: [Total(span5), hours, minutes]
  const totalCells = getAll(attRows[33], 'tc')
  setOrCreateText(totalCells[1], data.total_undertime_hours,   doc)
  setOrCreateText(totalCells[2], data.total_undertime_minutes, doc)
}

// ── Fix outer table: remove centering, full content width ────────────────────

function fixOuterTable(body: Element) {
  const CONTENT_W = 10546
  const CELL_W    = Math.floor(CONTENT_W / 2)
  const outerTbl  = getAll(body, 'tbl')[0]
  if (!outerTbl) return

  const tblPr = getAll(outerTbl, 'tblPr')[0]
  if (tblPr) {
    const tblW = getAll(tblPr, 'tblW')[0]
    if (tblW) tblW.setAttributeNS(W, 'w:w', String(CONTENT_W))
    const jc = getAll(tblPr, 'jc')[0]
    if (jc) jc.parentNode?.removeChild(jc)
  }
  getAll(outerTbl, 'gridCol').forEach(col => col.setAttributeNS(W, 'w:w', String(CELL_W)))
  getAll(getAll(outerTbl, 'tr')[0], 'tc').forEach(cell => {
    const tcW = getAll(getAll(cell, 'tcPr')[0], 'tcW')[0]
    if (tcW) tcW.setAttributeNS(W, 'w:w', String(CELL_W))
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateDTR(data: DTRData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'DTR-template.docx')
  const templateBuf  = fs.readFileSync(templatePath)

  const zip    = new PizZip(templateBuf)
  const xmlStr = zip.file('word/document.xml')!.asText()

  const parser     = new DOMParser()
  const serializer = new XMLSerializer()
  const doc        = parser.parseFromString(xmlStr, 'text/xml')
  const root       = doc.documentElement

  // Get outer table and its two cells
  const outerTbl  = getAll(root, 'tbl')[0]
  const outerRow  = getAll(outerTbl, 'tr')[0]
  const cells     = getAll(outerRow, 'tc')
  const leftCell  = cells[0]
  const rightCell = cells[1]

  // Clone left → right so both have identical structure
  const leftClone = leftCell.cloneNode(true) as Element
  rightCell.parentNode?.replaceChild(leftClone, rightCell)

  // Fill both cells
  const newCells = getAll(getAll(root, 'tbl')[0], 'tc')
  fillCell(newCells[0], data, doc)
  fillCell(newCells[1], data, doc)

  // Fix spacing
  fixOuterTable(root)

  // Serialize and repack
  zip.file('word/document.xml', serializer.serializeToString(doc))
  return Buffer.from(zip.generate({ type: 'arraybuffer' }))
}
```

---

## 5. API Route — `app/api/dtr/export/route.ts`

```typescript
export const runtime = 'nodejs' // required — fs not available on Edge

import { NextRequest, NextResponse } from 'next/server'
import { generateDTR } from '@/lib/dtr/generator'
import { prisma } from '@/lib/prisma'
import { DTRData } from '@/lib/dtr/types'

export async function POST(req: NextRequest) {
  try {
    const { employeeId, month, year } = await req.json()

    // 1. Fetch employee
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
    })

    // 2. Fetch attendance records for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate   = new Date(year, month, 0)

    const attendances = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    })

    // 3. Build DTR payload
    const monthLabel = startDate.toLocaleString('en-PH', {
      month: 'long', year: 'numeric',
    })

    let totalUTMinutes = 0
    const records = attendances.map(a => {
      const utMins = a.undertime_minutes ?? 0
      totalUTMinutes += utMins
      return {
        day:               a.date.getDate(),
        am_arrival:        a.am_arrival   ?? '',
        am_departure:      a.am_departure ?? '',
        pm_arrival:        a.pm_arrival   ?? '',
        pm_departure:      a.pm_departure ?? '',
        undertime_hours:   a.undertime_hours ? String(a.undertime_hours) : '',
        undertime_minutes: utMins > 0        ? String(utMins)            : '',
      }
    })

    const dtrData: DTRData = {
      name:                    `${employee.last_name}, ${employee.first_name}`,
      month:                   monthLabel,
      regular_days:            employee.work_schedule ?? 'Monday - Friday',
      saturdays:               'N/A',
      total_undertime_hours:   String(Math.floor(totalUTMinutes / 60)),
      total_undertime_minutes: String(totalUTMinutes % 60),
      records,
    }

    // 4. Generate and return
    const docxBuffer = await generateDTR(dtrData)
    const filename   = `DTR-${employee.last_name}-${monthLabel}.docx`

    return new NextResponse(docxBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[DTR Export]', err)
    return NextResponse.json({ error: 'Failed to generate DTR' }, { status: 500 })
  }
}
```

---

## 6. Export Button — `components/DTRExportButton.tsx`

```tsx
'use client'

import { useState } from 'react'

interface Props {
  employeeId: string
  month: number  // 1–12
  year: number
}

export function DTRExportButton({ employeeId, month, year }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dtr/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, month, year }),
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `DTR-${month}-${year}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export DTR. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Generating...' : '⬇ Export DTR'}
    </button>
  )
}
```

**Usage:**
```tsx
<DTRExportButton employeeId="emp_123" month={3} year={2026} />
```

---

## 8. Vercel Notes

| Concern | Answer |
|---|---|
| Template file access | `/public/templates/` — readable via `fs` in API routes |
| Native dependencies | None — pure JS only |
| Response size limit | Vercel default is 4.5MB; DTR is ~100KB ✓ |
| Runtime | Must use `nodejs` runtime — add `export const runtime = 'nodejs'` |
| Edge runtime | ❌ Not compatible — `fs` unavailable on Edge |

---

## 9. Quick Checklist

- [ ] `npm install pizzip @xmldom/xmldom`
- [ ] Copy `DTR-template.docx` → `public/templates/`
- [ ] Create `lib/dtr/types.ts`
- [ ] Create `lib/dtr/generator.ts`
- [ ] Create `app/api/dtr/export/route.ts` with `export const runtime = 'nodejs'`
- [ ] Add `<DTRExportButton>` to your employee page
- [ ] Test locally with `npm run dev`
- [ ] Deploy — works on Vercel out of the box
