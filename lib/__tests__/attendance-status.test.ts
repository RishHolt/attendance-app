import { describe, it, expect } from "vitest"
import { deriveAttendanceStatus } from "../attendance-status"
import { isLate } from "../time-calc"

describe("isLate", () => {
  it("returns false when clock in within 1 hour of scheduled", () => {
    expect(isLate("08:00", "08:00")).toBe(false)
    expect(isLate("08:10", "08:00")).toBe(false)
    expect(isLate("08:59", "08:00")).toBe(false)
  })

  it("returns true when clock in more than 1 hour after scheduled", () => {
    expect(isLate("09:01", "08:00")).toBe(true)
    expect(isLate("09:30", "08:00")).toBe(true)
  })

  it("returns false when clock in before scheduled", () => {
    expect(isLate("07:30", "08:00")).toBe(false)
  })
})

describe("deriveAttendanceStatus", () => {
  const todayStr = "2025-03-15"
  const tomorrowStr = "2025-03-16"
  const yesterdayStr = "2025-03-14"
  const scheduledTimeIn = "08:00"

  it("returns no-schedule when no schedule", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: false,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: todayStr,
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("no-schedule")
  })

  it("returns present when has time-in, time-out and within 1 hour of scheduled", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: true,
        hasTimeOut: true,
        scheduledTimeIn,
        actualTimeIn: "08:10",
        dateStr: todayStr,
        todayStr,
        tomorrowStr,
        startDateStr: null,
      })
    ).toBe("present")
  })

  it("returns late when has time-in, time-out and more than 1 hour after scheduled", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: true,
        hasTimeOut: true,
        scheduledTimeIn,
        actualTimeIn: "09:30",
        dateStr: todayStr,
        todayStr,
        tomorrowStr,
        startDateStr: null,
      })
    ).toBe("late")
  })

  it("returns incomplete when has time-in but no time-out", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: true,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: "08:10",
        dateStr: todayStr,
        todayStr,
        tomorrowStr,
        startDateStr: null,
      })
    ).toBe("incomplete")
  })

  it("returns upcoming for tomorrow only", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: tomorrowStr,
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("upcoming")
  })

  it("returns absent for past date on or after start date with no time-in", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: yesterdayStr,
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("absent")
  })

  it("returns absent when past date equals start date", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: "2025-01-01",
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("absent")
  })

  it("returns no-schedule for past date before start date", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: "2024-12-31",
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("no-schedule")
  })

  it("returns no-schedule for past date when no start date set", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: yesterdayStr,
        todayStr,
        tomorrowStr,
        startDateStr: null,
      })
    ).toBe("no-schedule")
  })

  it("returns no-schedule for today with no time-in", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: todayStr,
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("no-schedule")
  })

  it("returns no-schedule for future dates (except tomorrow)", () => {
    expect(
      deriveAttendanceStatus({
        hasSchedule: true,
        hasTimeIn: false,
        hasTimeOut: false,
        scheduledTimeIn,
        actualTimeIn: null,
        dateStr: "2025-03-20",
        todayStr,
        tomorrowStr,
        startDateStr: "2025-01-01",
      })
    ).toBe("no-schedule")
  })
})
