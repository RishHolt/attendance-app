import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { formatTime24 } from "@/lib/format-time"
import { deriveStatusFromTimes } from "@/lib/attendance-status"

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

function toPostgresTime(hhmm: string): string {
  if (!hhmm) return "00:00:00"
  const parts = String(hhmm).split(":")
  const h = (parts[0] ?? "00").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  const sec = (parts[2] ?? "00").padStart(2, "0")
  return `${h}:${m}:${sec}`
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Correction ID required" }, { status: 400 })
    }

    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { status } = body as { status?: "approved" | "rejected" }

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      )
    }
    const { data: correction } = await supabase
      .from("attendance_corrections")
      .select("id, attendance_id, user_id, requested_time_in, requested_time_out, status")
      .eq("id", id)
      .single()

    if (!correction) {
      return NextResponse.json({ error: "Correction not found" }, { status: 404 })
    }
    if (correction.status !== "pending") {
      return NextResponse.json(
        { error: "Correction has already been resolved" },
        { status: 400 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    const resolvedBy = user?.email
      ? (await supabase.from("users").select("id").eq("email", user.email.toLowerCase()).maybeSingle())
          .data?.id ?? null
      : null

    if (status === "approved") {
      const { data: att } = await supabase
        .from("attendances")
        .select("id, attendance_date, time_in, time_out")
        .eq("id", correction.attendance_id)
        .single()

      if (!att) {
        return NextResponse.json(
          { error: "Attendance record not found" },
          { status: 404 }
        )
      }

      const c = correction as {
        requested_time_in?: string | null
        requested_time_out?: string | null
        requestedTimeIn?: string | null
        requestedTimeOut?: string | null
      }
      let reqTimeInRaw = c.requested_time_in ?? c.requestedTimeIn ?? null
      let reqTimeOutRaw = c.requested_time_out ?? c.requestedTimeOut ?? null

      const currentTimeIn = att.time_in ? formatTime24(att.time_in) : null
      const hasNoTimeOut = !att.time_out

      const toMinutes = (t: string) => {
        const s = formatTime24(t)
        const [h, m] = s.split(":").map(Number)
        return (h ?? 0) * 60 + (m ?? 0)
      }

      if (
        hasNoTimeOut &&
        currentTimeIn &&
        reqTimeOutRaw != null &&
        String(reqTimeOutRaw).trim() !== ""
      ) {
        const outFormatted = formatTime24(reqTimeOutRaw)
        if (toMinutes(outFormatted) < toMinutes(currentTimeIn)) {
          const reqInSameAsCurrent =
            reqTimeInRaw != null &&
            String(reqTimeInRaw).trim() !== "" &&
            formatTime24(reqTimeInRaw) === currentTimeIn
          if (!reqTimeInRaw || reqInSameAsCurrent) {
            reqTimeInRaw = reqTimeOutRaw
            reqTimeOutRaw = null
          }
        }
      }

      const newTimeIn = reqTimeInRaw
        ? formatTime24(reqTimeInRaw)
        : att.time_in
          ? formatTime24(att.time_in)
          : null
      const newTimeOut = reqTimeOutRaw
        ? formatTime24(reqTimeOutRaw)
        : att.time_out
          ? formatTime24(att.time_out)
          : null
      const scheduledTimeIn = await getScheduledTimeInForDate(
        supabase,
        correction.user_id,
        att.attendance_date
      )
      const derivedStatus = deriveStatusFromTimes({
        timeIn: newTimeIn,
        timeOut: newTimeOut,
        scheduledTimeIn,
      })

      const attUpdates: Record<string, unknown> = {
        status: derivedStatus,
      }
      if (reqTimeInRaw != null && String(reqTimeInRaw).trim() !== "") {
        attUpdates.time_in = toPostgresTime(formatTime24(reqTimeInRaw))
      }
      if (reqTimeOutRaw != null && String(reqTimeOutRaw).trim() !== "") {
        attUpdates.time_out = toPostgresTime(formatTime24(reqTimeOutRaw))
      }
      if (newTimeIn && newTimeOut) {
        attUpdates.approval_status = "approved"
      }

      const { error: attError } = await supabase
        .from("attendances")
        .update(attUpdates)
        .eq("id", correction.attendance_id)

      if (attError) {
        return NextResponse.json(
          { error: `Failed to apply correction: ${attError.message}` },
          { status: 500 }
        )
      }
    }

    const { data: updated, error } = await supabase
      .from("attendance_corrections")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq("id", id)
      .select("id, status, resolved_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolved_at,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update correction" },
      { status: 500 }
    )
  }
}
