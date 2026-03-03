"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input } from "@/components/ui"

type AttendanceRow = {
  id: string
  date: string
  status: string
  timeIn: string | null
  timeOut: string | null
}

type RequestCorrectionModalProps = {
  open: boolean
  onClose: () => void
  row: AttendanceRow | null
  onSuccess: () => void
}

const toTimeInputValue = (t: string | null): string => {
  if (!t) return ""
  const parts = String(t).trim().split(":")
  const h = (parts[0] ?? "00").padStart(2, "0")
  const m = (parts[1] ?? "00").padStart(2, "0")
  return `${h}:${m}`
}

export const RequestCorrectionModal = ({
  open,
  onClose,
  row,
  onSuccess,
}: RequestCorrectionModalProps) => {
  const [requestedTimeIn, setRequestedTimeIn] = useState("")
  const [requestedTimeOut, setRequestedTimeOut] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && row) {
      setRequestedTimeIn(toTimeInputValue(row.timeIn))
      setRequestedTimeOut(toTimeInputValue(row.timeOut))
      setReason("")
      setError(null)
    }
  }, [open, row?.id, row?.timeIn, row?.timeOut])

  const handleSubmit = async () => {
    if (!row) return
    const ti = requestedTimeIn.trim()
    const to = requestedTimeOut.trim()
    const reasonTrimmed = reason.trim()
    if (!ti && !to) {
      setError("Please provide at least time in or time out")
      return
    }
    if (!reasonTrimmed) {
      setError("Reason is required")
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/attendance-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: row.id,
          requestedTimeIn: ti || undefined,
          requestedTimeOut: to || undefined,
          reason: reasonTrimmed,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to submit correction")
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError("Failed to submit correction")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request correction"
      description={
        row
          ? `Request correction for ${new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || !reason.trim()}
          >
            Submit request
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Input
            type="time"
            label="Correct time in"
            value={requestedTimeIn}
            onChange={(e) => setRequestedTimeIn(e.target.value)}
            disabled={isSubmitting}
            aria-describedby={row?.timeOut ? undefined : "time-in-hint"}
          />
          {row && !row.timeOut && (
            <p id="time-in-hint" className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Change this to the actual time you timed in (e.g. 8:00 AM if you forgot to time in earlier)
            </p>
          )}
        </div>
        <div>
          <Input
            type="time"
            label="Correct time out"
            value={requestedTimeOut}
            onChange={(e) => setRequestedTimeOut(e.target.value)}
            disabled={isSubmitting}
            aria-describedby={row?.timeOut ? undefined : "time-out-hint"}
          />
          {row && !row.timeOut && (
            <p id="time-out-hint" className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Leave empty if you have not timed out yet
            </p>
          )}
        </div>
        <Input
          label="Reason"
          placeholder="e.g. Forgot to time out"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isSubmitting}
          required
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
