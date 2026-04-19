import { describe, it, expect } from "vitest"
import { calcOjtProgress } from "@/lib/ojt-progress"

const att = (time_in: string, time_out: string, attendance_date = "2025-01-01") => ({
  time_in,
  time_out,
  attendance_date,
})

const sched = (dayOfWeek: number, timeIn: string, timeOut: string, breakDuration = 0) => ({
  dayOfWeek,
  customDate: null,
  timeIn,
  timeOut,
  breakDuration,
})

describe("calcOjtProgress", () => {
  it("sums hours when no schedules (fallback to raw diff)", () => {
    const rows = [att("08:00", "17:00"), att("08:00", "12:00")]
    const result = calcOjtProgress(rows, [], 486)
    expect(result.hoursCompleted).toBe(13)
  })

  it("applies schedule cap and break subtraction", () => {
    // Monday attendance 08:00-18:00, schedule 08:00-17:00, 1h break
    // actualM = 10h - 1h = 9h, scheduledM = 9h - 1h = 8h → capped at 8h
    const rows = [att("08:00", "18:00", "2025-01-06")] // Monday
    const schedules = [sched(1, "08:00", "17:00", 1)]
    const result = calcOjtProgress(rows, schedules, 486)
    expect(result.hoursCompleted).toBe(8)
  })

  it("skips rows missing time_in or time_out", () => {
    const rows = [
      { time_in: null, time_out: "17:00", attendance_date: "2025-01-01" },
      { time_in: "08:00", time_out: null, attendance_date: "2025-01-02" },
      att("09:00", "13:00"),
    ]
    const result = calcOjtProgress(rows, [], 486)
    expect(result.hoursCompleted).toBe(4)
  })

  it("returns hoursCompleted=0 and percent=0 when no attendances", () => {
    const result = calcOjtProgress([], [], 486)
    expect(result.hoursCompleted).toBe(0)
    expect(result.percent).toBe(0)
  })

  it("caps percent at 100 when hours exceeded", () => {
    const rows = [att("08:00", "18:00")]
    const result = calcOjtProgress(rows, [], 8)
    expect(result.percent).toBe(100)
  })

  it("returns percent=null when requiredHours is null", () => {
    const rows = [att("08:00", "17:00")]
    const result = calcOjtProgress(rows, [], null)
    expect(result.percent).toBeNull()
    expect(result.hoursCompleted).toBe(9)
  })

  it("returns percent=null when requiredHours is 0", () => {
    const result = calcOjtProgress([], [], 0)
    expect(result.percent).toBeNull()
  })

  it("rounds hoursCompleted to 2 decimal places", () => {
    const rows = [att("08:00", "09:10")]
    const result = calcOjtProgress(rows, [], 486)
    expect(result.hoursCompleted).toBe(1.17)
  })
})
