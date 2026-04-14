"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input } from "@/components/ui"
import type { AdminAttendanceRow } from "@/types"

type AddTimeOutModalProps = {
  open: boolean
  onClose: () => void
  row: AdminAttendanceRow | null
  onSuccess: (timeOut: string) => Promise<void>
  isSubmitting: boolean
}

export const AddTimeOutModal = ({
  open,
  onClose,
  row,
  onSuccess,
  isSubmitting,
}: AddTimeOutModalProps) => {
  const [timeOut, setTimeOut] = useState("")

  useEffect(() => {
    if (open) {
      setTimeOut("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!timeOut.trim()) return
    await onSuccess(timeOut.trim())
    setTimeOut("")
    onClose()
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setTimeOut("")
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add time out"
      description={
        row
          ? `Add time out for ${row.fullName} on ${new Date(row.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!timeOut.trim() || isSubmitting} isLoading={isSubmitting}>
            Add time out
          </Button>
        </div>
      }
    >
      <Input
        type="time"
        id="add-time-out"
        label="Time out"
        value={timeOut}
        onChange={(e) => setTimeOut(e.target.value)}
        disabled={isSubmitting}
        className="w-full"
      />
    </Modal>
  )
}
