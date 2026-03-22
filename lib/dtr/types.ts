export interface DTRRecord {
  day: number
  am_arrival: string
  am_departure: string
  pm_arrival: string
  pm_departure: string
  undertime_hours: string
  undertime_minutes: string
}

export interface DTRData {
  name: string
  month: string
  regular_days: string
  saturdays: string
  /** Total regular work time for the month (calendar “Total hours this month”) — hours part */
  total_work_hours: string
  /** Minutes part of total regular work */
  total_work_minutes: string
  records: DTRRecord[]
}
