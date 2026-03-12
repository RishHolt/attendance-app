import type { ScheduleRow } from "@/types/schedule"

export const getFirstScheduleDate = (schedules: ScheduleRow[]): string | null => {
  if (!schedules || schedules.length === 0) return null
  
  // Get all custom dates and the earliest date from user start date
  const customDates = schedules
    .filter(s => s.customDate)
    .map(s => s.customDate!)
    .filter(date => date && date.trim() !== '')
  
  if (customDates.length === 0) return null
  
  // Find the earliest custom date
  const earliestDate = customDates.reduce((earliest, current) => {
    return new Date(current) < new Date(earliest) ? current : earliest
  })
  
  return earliestDate
}

export const getDefaultReportRange = (
  schedules: ScheduleRow[],
  userStartDate?: string | null
): { from: string; to: string } => {
  const today = new Date()
  const toDate = today.toISOString().split('T')[0] ?? ''
  
  // Try to get first schedule date
  const firstScheduleDate = getFirstScheduleDate(schedules)
  
  let fromDate: string
  
  if (firstScheduleDate) {
    // Use first schedule date as start
    fromDate = firstScheduleDate.split('T')[0] ?? firstScheduleDate
  } else if (userStartDate) {
    // Use user start date as fallback
    fromDate = userStartDate.split('T')[0] ?? userStartDate
  } else {
    // Default to 30 days ago as last resort
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    fromDate = thirtyDaysAgo.toISOString().split('T')[0] ?? ''
  }
  
  return { from: fromDate, to: toDate }
}

// Helper function to convert API schedule response to proper ScheduleRow type
export const convertApiScheduleToScheduleRow = (apiSchedule: any): ScheduleRow => {
  return {
    id: apiSchedule.id,
    userId: apiSchedule.userId,
    dayOfWeek: apiSchedule.dayOfWeek ?? null,
    customDate: apiSchedule.customDate ?? null,
    timeIn: apiSchedule.timeIn,
    timeOut: apiSchedule.timeOut,
    breakTime: apiSchedule.breakTime ?? null,
    breakDuration: apiSchedule.breakDuration ?? null,
  }
}
