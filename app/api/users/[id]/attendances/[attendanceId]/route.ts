import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatTime24 } from "@/lib/format-time"
import { deriveStatusFromTimes } from "@/lib/attendance-status"

async function hasScheduleForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string
): Promise<boolean> {
  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay()
  const { data } = await supabase
    .from("schedules")
    .select("id, custom_date, day_of_week")
    .eq("user_id", userId)
  const rows = data ?? []
  const customMatch = rows.find((r) => (r as { custom_date?: string }).custom_date === dateStr)
  const recurringMatch = rows.find((r) => (r as { day_of_week?: number }).day_of_week === dayOfWeek)
  return !!(customMatch ?? recurringMatch)
}

async function getScheduledTimeInForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string
): Promise<string> {
  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay()
  const { data } = await supabase
    .from("schedules")
    .select("time_in, custom_date, day_of_week")
    .eq("user_id", userId)
  const rows = data ?? []
  const customMatch = rows.find((r) => (r as { custom_date?: string }).custom_date === dateStr)
  const recurringMatch = rows.find((r) => (r as { day_of_week?: number }).day_of_week === dayOfWeek)
  const match = customMatch ?? recurringMatch
  if (!match) return "09:00"
  const timeIn = (match as { time_in?: string }).time_in
  if (!timeIn) return "09:00"
  const s = String(timeIn)
  const parts = s.split(":")
  const h = (parts[0] ?? "09").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> }
) {
  try {
    const { attendanceId } = await params
    if (!attendanceId) {
      return NextResponse.json({ error: "Attendance ID required" }, { status: 400 })
    }

    const body = await request.json()
    const { status, timeIn, timeOut, approvalStatus, remarks } = body as {
      status?: "present" | "late" | "absent" | "incomplete"
      timeIn?: string | null
      timeOut?: string | null
      approvalStatus?: "pending" | "approved" | "denied"
      remarks?: string | null
    }

    const supabase = await createClient()
    const updates: Record<string, unknown> = {}
    if (timeIn !== undefined) updates.time_in = timeIn?.trim() || null
    if (timeOut !== undefined) updates.time_out = timeOut?.trim() || null
    if (status !== undefined) {
      if (!["present", "late", "absent", "incomplete"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      updates.status = status
    }
    if (approvalStatus !== undefined) {
      if (!["pending", "approved", "denied"].includes(approvalStatus)) {
        return NextResponse.json({ error: "Invalid approvalStatus" }, { status: 400 })
      }
      updates.approval_status = approvalStatus
      if (approvalStatus === "denied") {
        updates.status = "absent"
        updates.time_in = null
        updates.time_out = null
        updates.remarks = remarks?.trim() || null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const isUserClockInOrOut =
      (updates.time_in !== undefined && updates.time_in != null) ||
      (updates.time_out !== undefined && updates.time_out != null)
    if (isUserClockInOrOut && updates.approval_status === undefined) {
      const { data: att } = await supabase
        .from("attendances")
        .select("user_id, attendance_date")
        .eq("id", attendanceId)
        .single()
      if (att?.user_id && att?.attendance_date) {
        const hasSchedule = await hasScheduleForDate(
          supabase,
          att.user_id,
          att.attendance_date
        )
        if (!hasSchedule) {
          return NextResponse.json(
            {
              error:
                "You have no schedule for this date. Please contact your admin to set up your schedule.",
            },
            { status: 400 }
          )
        }
      }
    }

    if (updates.approval_status === "approved") {
      const { data: existing } = await supabase
        .from("attendances")
        .select("time_in, time_out")
        .eq("id", attendanceId)
        .single()
      if (!existing?.time_in || !existing?.time_out) {
        return NextResponse.json(
          { error: "Can only approve attendance when both time in and time out are recorded" },
          { status: 400 }
        )
      }
    }

    if (
      (updates.time_in !== undefined || updates.time_out !== undefined) &&
      updates.approval_status !== "denied"
    ) {
      const { data: existing } = await supabase
        .from("attendances")
        .select("user_id, attendance_date, time_in, time_out")
        .eq("id", attendanceId)
        .single()
      if (existing?.user_id && existing?.attendance_date) {
        const mergedTimeIn =
          updates.time_in !== undefined
            ? (updates.time_in as string | null)
            : existing.time_in
        const mergedTimeOut =
          updates.time_out !== undefined
            ? (updates.time_out as string | null)
            : existing.time_out
        const ti = mergedTimeIn ? formatTime24(mergedTimeIn) : null
        const to = mergedTimeOut ? formatTime24(mergedTimeOut) : null
        if (ti || to) {
          const scheduledTimeIn = await getScheduledTimeInForDate(
            supabase,
            existing.user_id,
            existing.attendance_date
          )
          updates.status = deriveStatusFromTimes({
            timeIn: ti,
            timeOut: to,
            scheduledTimeIn,
          })
        }
      }
    }

    const selectFields = "id, user_id, attendance_date, status, time_in, time_out, approval_status, remarks"
    const { data, error } = await supabase
      .from("attendances")
      .update(updates)
      .eq("id", attendanceId)
      .select(selectFields)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      date: data.attendance_date,
      status: data.status,
      approvalStatus: data.approval_status ?? "pending",
      timeIn: data.time_in ? formatTime24(data.time_in) : null,
      timeOut: data.time_out ? formatTime24(data.time_out) : null,
      remarks: data.remarks ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update attendance" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attendanceId: string }> }
) {
  try {
    const { attendanceId } = await params
    if (!attendanceId) {
      return NextResponse.json({ error: "Attendance ID required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("attendances").delete().eq("id", attendanceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete attendance" },
      { status: 500 }
    )
  }
}
