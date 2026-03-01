"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input } from "@/components/ui"
import { swal } from "@/lib/swal"
import Swal from "sweetalert2"
import { Trash2 } from "lucide-react"

export type AttendanceRow = {
  id: string
  userId: string
  date: string
  status: "present" | "late" | "absent"
  timeIn: string | null
  timeOut: string | null
}

type AttendanceModalProps = {
  open: boolean
  onClose: () => void
  mode: "add" | "edit"
  date: string
  dateLabel: string
  userId: string
  attendance?: AttendanceRow | null
  onSuccess?: () => void
}

const STATUS_OPTIONS: { value: "present" | "late" | "absent"; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
]

export const AttendanceModal = ({
  open,
  onClose,
  mode,
  date,
  dateLabel,
  userId,
  attendance,
  onSuccess,
}: AttendanceModalProps) => {
  const [status, setStatus] = useState<"present" | "late" | "absent">("present")
  const [timeIn, setTimeIn] = useState("")
  const [timeOut, setTimeOut] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      if (mode === "edit" && attendance) {
        setStatus(attendance.status)
        setTimeIn(attendance.timeIn ?? "")
        setTimeOut(attendance.timeOut ?? "")
      } else {
        setStatus("present")
        setTimeIn("")
        setTimeOut("")
      }
    }
  }, [open, mode, attendance])

  const handleClose = () => {
    if (!isSubmitting && !isDeleting) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (mode === "add") {
        const ti = timeIn.trim()
        const to = timeOut.trim()
        const statusToSend = !ti && !to ? "absent" : "present"
        const res = await fetch(`/api/users/${userId}/attendances`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            status: statusToSend,
            timeIn: ti || undefined,
            timeOut: to || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          swal.error(data.error ?? "Failed to add attendance")
          return
        }
        await swal.success("Attendance added")
      } else if (attendance) {
        const res = await fetch(`/api/users/${userId}/attendances/${attendance.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            timeIn: timeIn.trim() || null,
            timeOut: timeOut.trim() || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          swal.error(data.error ?? "Failed to update attendance")
          return
        }
        await swal.success("Attendance updated")
      }
      onClose()
      onSuccess?.()
    } catch {
      swal.error("Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!attendance) return
    const { isConfirmed } = await Swal.fire({
      title: "Delete attendance?",
      text: `This will remove the attendance record for ${dateLabel}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#71717a",
      confirmButtonText: "Delete",
    })
    if (!isConfirmed) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/users/${userId}/attendances/${attendance.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to delete attendance")
        return
      }
      await swal.success("Attendance deleted")
      onClose()
      onSuccess?.()
    } catch {
      swal.error("Something went wrong")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === "add" ? "Add attendance" : "Edit attendance"}
      description={`${dateLabel}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>
            {mode === "edit" && attendance && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isSubmitting}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-3 ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting || isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="attendance-form"
              disabled={isSubmitting || isDeleting}
            >
              {isSubmitting ? "Saving…" : mode === "add" ? "Add" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="attendance-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === "edit" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "present" | "late" | "absent")}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            type="time"
            label="Time in"
            value={timeIn}
            onChange={(e) => setTimeIn(e.target.value)}
          />
          <Input
            type="time"
            label="Time out"
            value={timeOut}
            onChange={(e) => setTimeOut(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}
