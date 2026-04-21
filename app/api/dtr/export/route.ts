export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { generateDTR } from '@/lib/dtr/generator'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { PH_LOCALE } from '@/lib/constants'
import { formatTime12, formatTime12NoAmPm } from '@/lib/format-time'
import { calcWorkMinutes } from '@/lib/time-calc'
import { buildDtrExportFileBaseName } from '@/lib/dtr/export-filename'
import { parsePaperSize } from '@/lib/dtr/paper'
import type { DTRData, DTRRecord } from '@/lib/dtr/types'

const parseTimeToMinutes = (t: string | null | undefined): number => {
  if (!t?.trim()) return 0
  const parts = String(t).trim().split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  return h * 60 + m
}

const minutesToHHMM = (totalMins: number): string => {
  const h = Math.floor(totalMins / 60) % 24
  const m = ((totalMins % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const { userId, month, year, singleColumn, paperSize } = await req.json() as {
      userId: string
      month: number
      year: number
      /** true = one DTR block (preview); false/omit = full document with duplicate columns */
      singleColumn?: boolean
      /** a4 | letter | folio | legal — drives Word section page size and table content width */
      paperSize?: string
    }

    if (!userId || !month || !year) {
      return NextResponse.json(
        { error: 'userId, month, and year are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, user_id, full_name, position, start_date')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fromStr = `${year}-${pad(month)}-01`
    const toStr = `${year}-${pad(month)}-${pad(endDate.getDate())}`

    const { data: schedules } = await supabase
      .from('schedules')
      .select('day_of_week, custom_date, time_in, time_out, break_time, break_duration')
      .eq('user_id', userId)

    const scheduleRows = schedules ?? []

    const getScheduleForDate = (dateStr: string, dayOfWeek: number) => {
      const customMatch = scheduleRows.find(r => {
        const cd = r.custom_date as string | null
        return cd ? String(cd).slice(0, 10) === dateStr : false
      })
      if (customMatch) return customMatch

      return scheduleRows.find(r => {
        const dow = r.day_of_week as number | null
        return typeof dow === 'number' && dow === dayOfWeek
      }) ?? null
    }

    const { data: attendances } = await supabase
      .from('attendances')
      .select('attendance_date, time_in, time_out, status')
      .eq('user_id', userId)
      .gte('attendance_date', fromStr)
      .lte('attendance_date', toStr)
      .order('attendance_date', { ascending: true })

    const attendanceMap = new Map(
      (attendances ?? []).map(a => [
        String(a.attendance_date).slice(0, 10),
        a,
      ])
    )

    const monthLabel = startDate.toLocaleString(PH_LOCALE, {
      month: 'long',
      year: 'numeric',
    })

    /** YYYY-MM-DD — days before this are not scheduled (matches calendar / employment start) */
    const userStartDateStr = user.start_date
      ? String(user.start_date).slice(0, 10)
      : null

    let totalRegularMinutesMonth = 0
    const records: DTRRecord[] = []
    const daysInMonth = endDate.getDate()
    /** Mon–Fri present days in month (scheduled days with attendance, not absent) */
    let regularPresentCount = 0
    /** Saturday present days in month */
    let saturdayPresentCount = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day)
      const dateStr = `${year}-${pad(month)}-${pad(day)}`
      if (userStartDateStr && dateStr < userStartDateStr) {
        continue
      }
      const dayOfWeek = d.getDay()
      const schedule = getScheduleForDate(dateStr, dayOfWeek)
      const att = attendanceMap.get(dateStr)

      if (!schedule) continue

      const isAbsent =
        att != null && String(att.status ?? '').toLowerCase() === 'absent'
      const isPresentDay = att != null && !isAbsent
      if (isPresentDay) {
        if (dayOfWeek >= 1 && dayOfWeek <= 5) regularPresentCount++
        else if (dayOfWeek === 6) saturdayPresentCount++
      }

      if (isAbsent) {
        records.push({
          day,
          am_arrival: '---',
          am_departure: '---',
          pm_arrival: '---',
          pm_departure: '---',
          undertime_hours: '',
          undertime_minutes: '',
        })
        continue
      }

      const timeIn = att?.time_in ? String(att.time_in) : null
      const timeOut = att?.time_out ? String(att.time_out) : null

      const scheduledMinutes = schedule.time_in && schedule.time_out
        ? Math.max(0,
            parseTimeToMinutes(schedule.time_out as string) -
            parseTimeToMinutes(schedule.time_in as string) -
            Math.round(((schedule.break_duration as number) ?? 0) * 60)
          )
        : 0

      let actualMinutes = 0
      if (timeIn && timeOut) {
        actualMinutes = Math.max(0,
          parseTimeToMinutes(timeOut) -
          parseTimeToMinutes(timeIn) -
          Math.round(((schedule.break_duration as number) ?? 0) * 60)
        )
      }

      const utMins = Math.max(0, scheduledMinutes - actualMinutes)

      if (
        schedule.time_in &&
        schedule.time_out &&
        timeIn &&
        timeOut
      ) {
        const breakH = (schedule.break_duration as number | null) ?? 0
        const actualM = calcWorkMinutes(timeIn, timeOut, breakH)
        const scheduledM = calcWorkMinutes(
          schedule.time_in as string,
          schedule.time_out as string,
          breakH
        )
        totalRegularMinutesMonth += Math.min(actualM, scheduledM)
      }

      const breakTimeRaw = schedule.break_time as string | null | undefined
      const breakDurH = (schedule.break_duration as number | null) ?? 0
      let amDeparture = ''
      let pmArrival = ''
      // Only split AM/PM around break when there is a full attendance day. Otherwise break times
      // (e.g. 12:00 / 1:00) look like real departure/arrival on future days or days not yet worked.
      if (breakTimeRaw?.trim() && timeIn && timeOut) {
        amDeparture = formatTime12NoAmPm(breakTimeRaw)
        const breakStartM = parseTimeToMinutes(breakTimeRaw)
        const breakEndM = breakStartM + Math.round(breakDurH * 60)
        pmArrival = formatTime12NoAmPm(minutesToHHMM(breakEndM))
      }

      records.push({
        day,
        am_arrival: timeIn ? formatTime12NoAmPm(timeIn) : '',
        am_departure: amDeparture,
        pm_arrival: pmArrival,
        pm_departure: timeOut ? formatTime12NoAmPm(timeOut) : '',
        undertime_hours: utMins > 0 && att && timeIn ? String(Math.floor(utMins / 60)) : '',
        undertime_minutes: utMins > 0 && att && timeIn ? String(utMins % 60) : '',
      })
    }

    // Build schedule time-range labels for Regular days and Saturdays fields
    const regularSchedule = scheduleRows.find(
      (r) => r.custom_date == null && r.day_of_week != null && (r.day_of_week as number) >= 1 && (r.day_of_week as number) <= 5
    )
    const saturdaySchedule = scheduleRows.find(
      (r) => r.custom_date == null && (r.day_of_week as number) === 6
    )

    const formatScheduleRange = (row: typeof scheduleRows[number] | undefined): string => {
      if (!row?.time_in || !row?.time_out) return ''
      return `${formatTime12(row.time_in as string)} - ${formatTime12(row.time_out as string)}`
    }

    const dtrData: DTRData = {
      name: user.full_name,
      month: monthLabel,
      regular_days: formatScheduleRange(regularSchedule),
      saturdays: formatScheduleRange(saturdaySchedule),
      total_work_hours: String(Math.floor(totalRegularMinutesMonth / 60)),
      total_work_minutes: String(totalRegularMinutesMonth % 60),
      records,
    }

    const docxBuffer = await generateDTR(dtrData, {
      singleColumn: singleColumn === true,
      paperSize: parsePaperSize(paperSize),
    })
    const filename = `${buildDtrExportFileBaseName(user.full_name, monthLabel)}.docx`

    const responseBody = new Uint8Array(docxBuffer)
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[DTR Export]', err)
    return NextResponse.json(
      { error: 'Failed to generate DTR' },
      { status: 500 }
    )
  }
}
