"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input, Label } from "@/components/ui"
import { getDefaultReportRange } from "@/lib/schedule-utils"
import type { ScheduleRow } from "@/types/schedule"

const SUPERVISOR_STORAGE_KEY = "attendance-export-supervisor"

type ExportPdfModalProps = {
  open: boolean
  onClose: () => void
  onExport: (opts: {
    mode: "month" | "custom"
    dateStart?: string
    dateEnd?: string
    supervisorName: string
    supervisorPosition: string
  }) => Promise<void>
  currentMonthLabel: string
  disabled?: boolean
  schedules?: ScheduleRow[]
  userStartDate?: string | null
}

export const ExportPdfModal = ({
  open,
  onClose,
  onExport,
  currentMonthLabel,
  disabled,
  schedules,
  userStartDate,
}: ExportPdfModalProps) => {
  const [mode, setMode] = useState<"month" | "custom">("month")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [supervisorName, setSupervisorName] = useState("")
  const [supervisorPosition, setSupervisorPosition] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SUPERVISOR_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as { name?: string; position?: string }
          if (parsed.name) setSupervisorName(parsed.name)
          if (parsed.position) setSupervisorPosition(parsed.position)
        }
      } catch {
        // ignore
      }
    }
  }, [open])

  const handleSupervisorBlur = () => {
    try {
      localStorage.setItem(
        SUPERVISOR_STORAGE_KEY,
        JSON.stringify({ name: supervisorName, position: supervisorPosition })
      )
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (open && mode === "custom") {
      // Use smart defaults based on schedule and user start date
      const defaultRange = getDefaultReportRange(schedules || [], userStartDate)
      setDateStart(defaultRange.from)
      setDateEnd(defaultRange.to)
    }
  }, [open, mode, schedules, userStartDate])

  const handleExport = async () => {
    if (mode === "custom" && (!dateStart || !dateEnd)) return
    if (new Date(dateStart) > new Date(dateEnd)) return
    setIsExporting(true)
    try {
      await onExport({
        mode,
        dateStart: mode === "custom" ? dateStart : undefined,
        dateEnd: mode === "custom" ? dateEnd : undefined,
        supervisorName: supervisorName.trim() || "Supervisor",
        supervisorPosition: supervisorPosition.trim() || "Position",
      })
      handleSupervisorBlur()
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  const canExport =
    mode === "month" ||
    (mode === "custom" && dateStart && dateEnd && new Date(dateStart) <= new Date(dateEnd))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="View attendance report"
      description="For verification of supervisor"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={!canExport || isExporting || disabled}
          >
            {isExporting ? "Loading…" : "View Report"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <Label className="block mb-3">Date range</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="export-mode"
                checked={mode === "month"}
                onChange={() => setMode("month")}
                className="border-zinc-300 focus:ring-zinc-500 w-4 h-4 text-zinc-600"
              />
              <span className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                This month ({currentMonthLabel})
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="export-mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
                className="border-zinc-300 focus:ring-zinc-500 w-4 h-4 text-zinc-600"
              />
              <span className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                Custom date range
              </span>
            </label>
          </div>
        </div>

        {mode === "custom" && (
          <div className="gap-4 grid grid-cols-2">
            <Input
              type="date"
              label="Start date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
            <Input
              type="date"
              label="End date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
        )}

        <div className="pt-4 border-zinc-200 dark:border-zinc-700 border-t">
          <div className="gap-4 grid sm:grid-cols-2">
            <Input
              type="text"
              label="Supervisor name"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              onBlur={handleSupervisorBlur}
              placeholder="e.g. Jane Smith"
            />
            <Input
              type="text"
              label="Position"
              value={supervisorPosition}
              onChange={(e) => setSupervisorPosition(e.target.value)}
              onBlur={handleSupervisorBlur}
              placeholder="e.g. Team Lead"
            />
          </div>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 text-xs">
            Saved to this device for next time
          </p>
        </div>
      </div>
    </Modal>
  )
}
