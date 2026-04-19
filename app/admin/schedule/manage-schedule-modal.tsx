"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Calendar, ChevronRight } from "lucide-react"
import Swal from "sweetalert2"
import { Button, Input, Label, Modal, useModalClose } from "@/components/ui"
import { formatTime12 } from "@/lib/format-time"
import { swal } from "@/lib/swal"

type UserRow = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
  endDate: string | null
  role: "employee" | "admin" | "ojt"
  requiredHours?: number | null
}

type ScheduleRow = {
  id: string
  userId: string
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakTime: string | null
  breakDuration: number | null
}

type ScheduleValues = {
  timeIn: string
  timeOut: string
  breakTime: string
  breakDuration: number
}

type DayEntry = {
  enabled: boolean
} & ScheduleValues

type WeeklySchedule = {
  defaultTemplate: ScheduleValues
  days: Record<number, DayEntry>
}

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const

const createEmptySchedule = (): ScheduleValues => ({
  timeIn: "",
  timeOut: "",
  breakTime: "",
  breakDuration: 0,
})

const createEmptyDayEntry = (): DayEntry => ({
  enabled: false,
  ...createEmptySchedule(),
})

const createInitialWeeklySchedule = (): WeeklySchedule => {
  const days: Record<number, DayEntry> = {}
  for (let d = 0; d <= 6; d++) {
    days[d] = createEmptyDayEntry()
  }
  return {
    defaultTemplate: createEmptySchedule(),
    days,
  }
}

const padTime = (s: string): string => {
  if (!s || !s.includes(":")) return s
  const [h, m] = s.split(":")
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`
}

const isScheduleEqual = (a: ScheduleValues, b: ScheduleValues): boolean =>
  padTime(a.timeIn) === padTime(b.timeIn) &&
  padTime(a.timeOut) === padTime(b.timeOut) &&
  padTime(a.breakTime) === padTime(b.breakTime) &&
  a.breakDuration === b.breakDuration

function isWeeklyScheduleEqual(a: WeeklySchedule, b: WeeklySchedule): boolean {
  if (!isScheduleEqual(a.defaultTemplate, b.defaultTemplate)) return false
  for (let d = 0; d <= 6; d++) {
    const ad = a.days[d] ?? createEmptyDayEntry()
    const bd = b.days[d] ?? createEmptyDayEntry()
    if (ad.enabled !== bd.enabled) return false
    if (ad.enabled && !isScheduleEqual(ad, bd)) return false
  }
  return true
}

const scheduleRowToValues = (row: ScheduleRow): ScheduleValues => ({
  timeIn: padTime(row.timeIn),
  timeOut: padTime(row.timeOut),
  breakTime: row.breakTime ? padTime(row.breakTime) : "12:00",
  breakDuration: row.breakDuration ?? 1,
})

function updateDefault(
  prev: WeeklySchedule,
  field: keyof ScheduleValues,
  value: string | number
): WeeklySchedule {
  const newDefault = {
    ...prev.defaultTemplate,
    [field]: value,
  }
  const updatedDays = { ...prev.days }
  for (let d = 0; d <= 6; d++) {
    const entry = updatedDays[d]
    if (!entry?.enabled) continue
    const dayVals = {
      timeIn: entry.timeIn,
      timeOut: entry.timeOut,
      breakTime: entry.breakTime,
      breakDuration: entry.breakDuration,
    }
    if (isScheduleEqual(dayVals, prev.defaultTemplate)) {
      updatedDays[d] = { ...entry, ...newDefault }
    }
  }
  return {
    ...prev,
    defaultTemplate: newDefault,
    days: updatedDays,
  }
}

function updateDay(
  prev: WeeklySchedule,
  day: number,
  updates: Partial<ScheduleValues>
): WeeklySchedule {
  const current = prev.days[day] ?? createEmptyDayEntry()
  return {
    ...prev,
    days: {
      ...prev.days,
      [day]: {
        ...current,
        ...updates,
      },
    },
  }
}

function setDayEnabled(prev: WeeklySchedule, day: number, enabled: boolean): WeeklySchedule {
  const current = prev.days[day] ?? createEmptyDayEntry()
  const nextEntry: DayEntry = enabled
    ? { ...current, enabled: true, ...prev.defaultTemplate }
    : { ...current, enabled: false }
  return {
    ...prev,
    days: {
      ...prev.days,
      [day]: nextEntry,
    },
  }
}

function getScheduleForDay(schedule: WeeklySchedule, day: number): ScheduleValues {
  const entry = schedule.days[day]
  if (!entry) return createEmptySchedule()
  return {
    timeIn: entry.timeIn,
    timeOut: entry.timeOut,
    breakTime: entry.breakTime,
    breakDuration: entry.breakDuration,
  }
}

function isCustomDay(schedule: WeeklySchedule, day: number): boolean {
  const entry = schedule.days[day]
  if (!entry?.enabled) return false
  return !isScheduleEqual(
    {
      timeIn: entry.timeIn,
      timeOut: entry.timeOut,
      breakTime: entry.breakTime,
      breakDuration: entry.breakDuration,
    },
    schedule.defaultTemplate
  )
}

function getSelectedDays(schedule: WeeklySchedule): number[] {
  return DAY_OPTIONS.filter((opt) => schedule.days[opt.value]?.enabled).map((opt) => opt.value)
}

function getCustomDays(schedule: WeeklySchedule): number[] {
  return DAY_OPTIONS.filter((opt) => isCustomDay(schedule, opt.value)).map((opt) => opt.value)
}

function revertDayToDefault(prev: WeeklySchedule, day: number): WeeklySchedule {
  const current = prev.days[day]
  if (!current?.enabled) return prev
  return {
    ...prev,
    days: {
      ...prev.days,
      [day]: {
        ...current,
        ...prev.defaultTemplate,
      },
    },
  }
}

type DefaultScheduleSectionProps = {
  schedule: ScheduleValues
  onDefaultChange: (field: keyof ScheduleValues, value: string | number) => void
}

function DefaultScheduleSection({ schedule, onDefaultChange }: DefaultScheduleSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
      <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Applied to checked days
      </p>
      <div className="space-y-3" data-form="default-schedule-only">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="default-time-in" className="text-xs">
              Time in
            </Label>
            <Input
              id="default-time-in"
              type="time"
              value={schedule.timeIn}
              onChange={(e) => onDefaultChange("timeIn", e.target.value)}
              placeholder="09:00"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="default-time-out" className="text-xs">
              Time out
            </Label>
            <Input
              id="default-time-out"
              type="time"
              value={schedule.timeOut}
              onChange={(e) => onDefaultChange("timeOut", e.target.value)}
              placeholder="17:00"
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="default-break-time" className="text-xs">
              Break time
            </Label>
            <Input
              id="default-break-time"
              type="time"
              value={schedule.breakTime}
              onChange={(e) => onDefaultChange("breakTime", e.target.value)}
              placeholder="12:00"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="default-break-duration" className="text-xs">
              Duration (hour)
            </Label>
            <Input
              id="default-break-duration"
              type="number"
              min={0}
              step={0.5}
              value={schedule.breakDuration || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onDefaultChange("breakDuration", !Number.isNaN(v) && v >= 0 ? v : 0)
              }}
              placeholder="1"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

type DayCheckboxRowProps = {
  day: (typeof DAY_OPTIONS)[number]
  checked: boolean
  onToggle: () => void
  isCustom?: boolean
  scheduleTimes?: string
}

function DayCheckboxRow({
  day,
  checked,
  onToggle,
  isCustom = false,
  scheduleTimes,
}: DayCheckboxRowProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        isCustom
          ? "border-blue-300 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-950/30"
          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-900"
        aria-label={day.label}
      />
      <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {day.label}
      </span>
      {isCustom && scheduleTimes && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {scheduleTimes}
        </span>
      )}
    </label>
  )
}

type CustomScheduleModalProps = {
  open: boolean
  schedule: WeeklySchedule
  onScheduleChange: React.Dispatch<React.SetStateAction<WeeklySchedule>>
  onClose: () => void
}

function CustomScheduleModal({
  open,
  schedule,
  onScheduleChange,
  onClose,
}: CustomScheduleModalProps) {
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const customDays = getCustomDays(schedule)
  const enabledDays = getSelectedDays(schedule)
  const availableToAdd = enabledDays.filter((d) => !customDays.includes(d))
  const requestClose = useModalClose()

  const handleCustomChange = useCallback(
    (day: number, updates: Partial<ScheduleValues>) => {
      onScheduleChange((prev) => updateDay(prev, day, updates))
    },
    [onScheduleChange]
  )

  const handleRevertToDefault = useCallback(
    async (day: number) => {
      const dayLabel = DAY_OPTIONS.find((d) => d.value === day)?.label ?? "this day"
      const { isConfirmed } = await Swal.fire({
        title: "Remove custom schedule?",
        text: `This will revert ${dayLabel} to the default schedule.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc2626",
      })
      if (!isConfirmed) return
      onScheduleChange((prev) => revertDayToDefault(prev, day))
      setEditingDay(null)
    },
    [onScheduleChange]
  )

  const handleStartAddCustom = useCallback((day: number) => {
    setEditingDay(day)
  }, [])

  if (!open) return null

  const allSelectable = [...availableToAdd, ...customDays]
  const hasSelectable = allSelectable.length > 0

  const handleClose = async () => {
    await swal.success("Custom schedule updated")
    requestClose()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Custom schedule"
      description="Override default times for specific days"
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={handleClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {customDays.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Custom days
            </p>
            <ul className="space-y-2">
              {customDays.map((dayValue) => {
                const day = DAY_OPTIONS.find((d) => d.value === dayValue)!
                const s = getScheduleForDay(schedule, dayValue)
                const isEditing = editingDay === dayValue
                return (
                  <li
                    key={dayValue}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {day.label}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditingDay((p) => (p === dayValue ? null : dayValue))
                          }
                        >
                          {isEditing ? "Done" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevertToDefault(dayValue)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {isEditing ? (
                      <CustomDayForm
                        dayValue={dayValue}
                        schedule={s}
                        onCustomChange={handleCustomChange}
                      />
                    ) : (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {formatTime12(s.timeIn)} – {formatTime12(s.timeOut)}
                        {s.breakTime &&
                          ` · Break: ${formatTime12(s.breakTime)} (${s.breakDuration}h)`}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {hasSelectable ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Add custom schedule
              </p>
              <div className="flex flex-wrap gap-2">
                {allSelectable.map((dayValue) => {
                  const day = DAY_OPTIONS.find((d) => d.value === dayValue)!
                  const isActive = editingDay === dayValue
                  return (
                    <Button
                      key={dayValue}
                      type="button"
                      variant={isActive ? "default" : "secondary"}
                      size="sm"
                      onClick={() =>
                        setEditingDay((p) => (p === dayValue ? null : dayValue))
                      }
                    >
                      {day.label}
                    </Button>
                  )
                })}
              </div>
              {editingDay !== null && availableToAdd.includes(editingDay) && (
                <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {DAY_OPTIONS.find((d) => d.value === editingDay)?.label}
                    </span>
                  </div>
                  <CustomDayForm
                    dayValue={editingDay}
                    schedule={getScheduleForDay(schedule, editingDay)}
                    onCustomChange={handleCustomChange}
                  />
                </div>
              )}
            </div>
          </>
        ) : customDays.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Enable days in the default schedule first.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

type CustomDayFormProps = {
  dayValue: number
  schedule: ScheduleValues
  onCustomChange: (day: number, updates: Partial<ScheduleValues>) => void
}

function CustomDayForm({ dayValue, schedule, onCustomChange }: CustomDayFormProps) {
  const handleChange = useCallback(
    (updates: Partial<ScheduleValues>) => onCustomChange(dayValue, updates),
    [dayValue, onCustomChange]
  )
  const prefix = `custom-${dayValue}`
  return (
    <div className="grid grid-cols-2 gap-4" data-form={`custom-day-${dayValue}`}>
      <div>
        <Label htmlFor={`${prefix}-time-in`} className="text-xs">
          Time in
        </Label>
        <Input
          id={`${prefix}-time-in`}
          type="time"
          value={schedule.timeIn}
          onChange={(e) => handleChange({ timeIn: e.target.value })}
          placeholder="09:00"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-time-out`} className="text-xs">
          Time out
        </Label>
        <Input
          id={`${prefix}-time-out`}
          type="time"
          value={schedule.timeOut}
          onChange={(e) => handleChange({ timeOut: e.target.value })}
          placeholder="17:00"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-break-time`} className="text-xs">
          Break time
        </Label>
        <Input
          id={`${prefix}-break-time`}
          type="time"
          value={schedule.breakTime}
          onChange={(e) => handleChange({ breakTime: e.target.value })}
          placeholder="12:00"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-break-duration`} className="text-xs">
          Duration (hour)
        </Label>
        <Input
          id={`${prefix}-break-duration`}
          type="number"
          min={0}
          step={0.5}
          value={schedule.breakDuration || ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            handleChange({ breakDuration: !Number.isNaN(v) && v >= 0 ? v : 0 })
          }}
          placeholder="1"
          className="mt-1"
        />
      </div>
    </div>
  )
}

type ManageScheduleModalProps = {
  open: boolean
  user: UserRow | null
  onClose: () => void
}

type SchedulesResponse = {
  rows?: ScheduleRow[]
  defaultTemplate?: {
    timeIn: string
    timeOut: string
    breakTime: string | null
    breakDuration: number | null
  }
}

const fetchSchedules = async (userId: string): Promise<SchedulesResponse> => {
  const res = await fetch(`/api/users/${userId}/schedules`)
  if (!res.ok) return { rows: [] }
  const data = await res.json()
  if (Array.isArray(data)) return { rows: data }
  return { rows: data.rows ?? [], defaultTemplate: data.defaultTemplate ?? undefined }
}

export function ManageScheduleModal({ open, user, onClose }: ManageScheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [schedule, setSchedule] = useState<WeeklySchedule>(createInitialWeeklySchedule())
  const [startDate, setStartDate] = useState("")
  const initialScheduleRef = useRef<WeeklySchedule>(createInitialWeeklySchedule())
  const initialStartDateRef = useRef("")

  useEffect(() => {
    if (!open || !user) return
    const userId = user.id
    setCustomModalOpen(false)
    setStartDate(user.startDate ?? "")
    initialStartDateRef.current = user.startDate ?? ""
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const { rows, defaultTemplate: apiDefault } = await fetchSchedules(userId)
      if (cancelled) return
      const recurring = (rows ?? []).filter((s) => s.dayOfWeek !== null)
      if (recurring.length === 0) {
        const empty = createInitialWeeklySchedule()
        setSchedule(empty)
        initialScheduleRef.current = empty
        setIsLoading(false)
        return
      }
      const days: Record<number, DayEntry> = {}
      for (let d = 0; d <= 6; d++) {
        days[d] = createEmptyDayEntry()
      }
      let defaultTemplate: ScheduleValues
      if (apiDefault) {
        defaultTemplate = {
          timeIn: apiDefault.timeIn,
          timeOut: apiDefault.timeOut,
          breakTime: apiDefault.breakTime ?? "12:00",
          breakDuration: apiDefault.breakDuration ?? 1,
        }
      } else {
        const scheduleCounts = new Map<string, { count: number; vals: ScheduleValues }>()
        for (const row of recurring) {
          if (row.dayOfWeek == null) continue
          const vals = scheduleRowToValues(row)
          const key = `${vals.timeIn}|${vals.timeOut}|${vals.breakTime ?? ""}|${vals.breakDuration ?? 0}`
          const existing = scheduleCounts.get(key)
          if (existing) existing.count += 1
          else scheduleCounts.set(key, { count: 1, vals })
        }
        const mostCommon = [...scheduleCounts.values()].reduce((best, curr) =>
          curr.count > best.count ? curr : best
        , { count: 0, vals: scheduleRowToValues(recurring[0]) })
        defaultTemplate = { ...mostCommon.vals }
      }
      for (const row of recurring) {
        if (row.dayOfWeek == null) continue
        const vals = scheduleRowToValues(row)
        days[row.dayOfWeek] = { enabled: true, ...vals }
      }
      const loaded = { defaultTemplate, days }
      setSchedule(loaded)
      initialScheduleRef.current = loaded
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, user])

  const handleDefaultChange = useCallback((field: keyof ScheduleValues, value: string | number) => {
    setSchedule((prev) => updateDefault(prev, field, value))
  }, [])

  const handleToggleDay = useCallback((day: number) => {
    setSchedule((prev) => {
      const current = prev.days[day]?.enabled ?? false
      return setDayEnabled(prev, day, !current)
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!user) return
    const selectedDays = getSelectedDays(schedule)
    if (selectedDays.length === 0) {
      swal.error("Select at least one day")
      return
    }
    const schedulesToSave = selectedDays.map((day) => {
      const s = getScheduleForDay(schedule, day)
      return {
        dayOfWeek: day,
        timeIn: padTime(s.timeIn.trim()),
        timeOut: padTime(s.timeOut.trim()),
        breakTime: s.breakTime?.trim() ? padTime(s.breakTime.trim()) : null,
        breakDuration: s.breakDuration >= 0 ? s.breakDuration : null,
      }
    })
    const invalid = schedulesToSave.find((s) => !s.timeIn || !s.timeOut)
    if (invalid) {
      swal.error("Time in and time out are required for each selected day")
      return
    }
    for (const s of schedulesToSave) {
      const [sh, sm] = s.timeIn.split(":").map(Number)
      const [eh, em] = s.timeOut.split(":").map(Number)
      if ((eh ?? 0) * 60 + (em ?? 0) <= (sh ?? 0) * 60 + (sm ?? 0)) {
        swal.error("Time out must be after time in")
        return
      }
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}/schedules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: schedulesToSave,
          defaultTemplate: {
            timeIn: padTime(schedule.defaultTemplate.timeIn.trim()),
            timeOut: padTime(schedule.defaultTemplate.timeOut.trim()),
            breakTime: schedule.defaultTemplate.breakTime?.trim()
              ? padTime(schedule.defaultTemplate.breakTime.trim())
              : null,
            breakDuration:
              schedule.defaultTemplate.breakDuration >= 0
                ? schedule.defaultTemplate.breakDuration
                : null,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to save schedule")
        return
      }
      const startDateTrimmed = startDate.trim() || null
      if (startDateTrimmed !== (initialStartDateRef.current || null)) {
        const patchRes = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: startDateTrimmed }),
        })
        if (!patchRes.ok) {
          const patchData = await patchRes.json()
          swal.error(patchData.error ?? "Failed to save start date")
          return
        }
        initialStartDateRef.current = startDateTrimmed ?? ""
      }
      initialScheduleRef.current = schedule
      initialStartDateRef.current = startDateTrimmed ?? ""
      swal.success("Schedule saved")
    } catch {
      swal.error("Failed to save schedule")
    } finally {
      setIsSaving(false)
    }
  }, [user, schedule, startDate])

  if (!user) return null

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage schedule"
        description={`Schedule for ${user.fullName}`}
        footer={
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={
                isSaving ||
                (isWeeklyScheduleEqual(schedule, initialScheduleRef.current) &&
                  startDate === initialStartDateRef.current)
              }
              className="flex-1"
            >
              {isSaving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        }
      >
        <ManageScheduleModalContent
          isLoading={isLoading}
          isSaving={isSaving}
          schedule={schedule}
          startDate={startDate}
          onStartDateChange={setStartDate}
          onDefaultChange={handleDefaultChange}
          onToggleDay={handleToggleDay}
          onOpenCustomSchedule={() => setCustomModalOpen(true)}
          onSave={handleSave}
        />
      </Modal>
      <CustomScheduleModal
        open={customModalOpen}
        schedule={schedule}
        onScheduleChange={setSchedule}
        onClose={() => setCustomModalOpen(false)}
      />
    </>
  )
}

type ManageScheduleModalContentProps = {
  isLoading: boolean
  isSaving: boolean
  schedule: WeeklySchedule
  startDate: string
  onStartDateChange: (value: string) => void
  onDefaultChange: (field: keyof ScheduleValues, value: string | number) => void
  onToggleDay: (day: number) => void
  onOpenCustomSchedule: () => void
  onSave: () => void
}

function ManageScheduleModalContent({
  isLoading,
  schedule,
  startDate,
  onStartDateChange,
  onDefaultChange,
  onToggleDay,
  onOpenCustomSchedule,
}: ManageScheduleModalContentProps) {
  const customDayCount = getCustomDays(schedule).length

  return (
    <div className="flex flex-col gap-5">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Loading schedule…
          </p>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="start-date" className="text-xs">
              Start date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="mt-1"
              aria-label="Employee start date"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              When the employee starts working. Calendar will only track attendance from this date.
            </p>
          </div>
          <DefaultScheduleSection
            schedule={schedule.defaultTemplate}
            onDefaultChange={onDefaultChange}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Days using default schedule
            </p>
            {DAY_OPTIONS.map((day) => {
              const enabled = schedule.days[day.value]?.enabled ?? false
              const custom = enabled && isCustomDay(schedule, day.value)
              const s = custom ? getScheduleForDay(schedule, day.value) : null
              const times = s
                ? `${formatTime12(s.timeIn)} – ${formatTime12(s.timeOut)}${s.breakTime ? ` · Break: ${formatTime12(s.breakTime)} (${s.breakDuration}h)` : ""}`
                : undefined
              return (
                <DayCheckboxRow
                  key={day.value}
                  day={day}
                  checked={enabled}
                  onToggle={() => onToggleDay(day.value)}
                  isCustom={custom}
                  scheduleTimes={times}
                />
              )
            })}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Calendar className="h-4 w-4 shrink-0" aria-hidden />}
              rightIcon={<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
              className="inline-flex w-fit items-center"
              onClick={onOpenCustomSchedule}
            >
              <span className="inline-flex items-center gap-2">
                Add custom schedule
                {customDayCount > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    {customDayCount} {customDayCount === 1 ? "day" : "days"}
                  </span>
                )}
              </span>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
