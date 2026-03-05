"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input } from "@/components/ui"
import type { AdminAttendanceRow } from "@/types"

type DenyAttendanceModalProps = {
  open: boolean
  onClose: () => void
  row: AdminAttendanceRow | null
  onDeny: (remarks: string) => Promise<void>
  isDenying: boolean
}

export const DenyAttendanceModal = ({
  open,
  onClose,
  row,
  onDeny,
  isDenying,
}: DenyAttendanceModalProps) => {
  const [remarks, setRemarks] = useState("")

  useEffect(() => {
    if (open) setRemarks("")
  }, [open, row?.id])

  const handleDeny = async () => {
    await onDeny(remarks)
    setRemarks("")
    onClose()
  }

  const handleClose = () => {
    if (!isDenying) {
      setRemarks("")
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Deny attendance"
      description={
        row
          ? `Deny attendance for ${row.fullName} on ${new Date(row.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}?`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isDenying}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleDeny}
            isLoading={isDenying}
            disabled={isDenying}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Deny
          </Button>
        </div>
      }
    >
      <Input
        id="deny-remarks"
        label="Remarks (optional)"
        placeholder="Reason for denial..."
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className="w-full"
        disabled={isDenying}
      />
    </Modal>
  )
}
