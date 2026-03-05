export type ScheduleRow = {
  id: string
  userId: string
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakTime: string | null
  breakDuration: number | null
}

export type ScheduleSummary = {
  userId: string
  hasSchedule: boolean
  summary: string
}
