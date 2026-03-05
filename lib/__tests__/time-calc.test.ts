import { describe, it, expect } from "vitest"
import {
  parseTimeToMinutes,
  formatMinutesAsHours,
  calcWorkMinutes,
  formatTotalWithOvertime,
  isLate,
} from "../time-calc"

describe("parseTimeToMinutes", () => {
  it("parses HH:MM to minutes since midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0)
    expect(parseTimeToMinutes("08:30")).toBe(8 * 60 + 30)
    expect(parseTimeToMinutes("23:59")).toBe(23 * 60 + 59)
  })

  it("handles null and empty", () => {
    expect(parseTimeToMinutes(null)).toBe(0)
    expect(parseTimeToMinutes("")).toBe(0)
    expect(parseTimeToMinutes("   ")).toBe(0)
  })

  it("handles single digit hour", () => {
    expect(parseTimeToMinutes("9:00")).toBe(9 * 60)
  })
})

describe("formatMinutesAsHours", () => {
  it("formats minutes to Xh Ym or Xh", () => {
    expect(formatMinutesAsHours(0)).toBe("0h")
    expect(formatMinutesAsHours(60)).toBe("1h")
    expect(formatMinutesAsHours(90)).toBe("1h 30m")
    expect(formatMinutesAsHours(480)).toBe("8h")
  })

  it("handles negative as 0h", () => {
    expect(formatMinutesAsHours(-1)).toBe("0h")
  })
})

describe("calcWorkMinutes", () => {
  it("computes work minutes minus break", () => {
    expect(calcWorkMinutes("08:00", "17:00", 1)).toBe(8 * 60) // 9h - 1h break = 8h
    expect(calcWorkMinutes("09:00", "18:00", 0.5)).toBe(8 * 60 + 30)
  })

  it("returns 0 when result would be negative", () => {
    expect(calcWorkMinutes("17:00", "08:00", 0)).toBe(0)
  })
})

describe("formatTotalWithOvertime", () => {
  it("returns regular only when total <= scheduled", () => {
    expect(formatTotalWithOvertime(480, 480)).toBe("8h")
    expect(formatTotalWithOvertime(420, 480)).toBe("7h")
  })

  it("appends OT when total exceeds scheduled", () => {
    expect(formatTotalWithOvertime(600, 480)).toBe("8h (+2h OT)")
  })
})

describe("isLate", () => {
  it("returns false when within 1 hour of scheduled", () => {
    expect(isLate("08:00", "08:00")).toBe(false)
    expect(isLate("08:30", "08:00")).toBe(false)
    expect(isLate("08:59", "08:00")).toBe(false)
  })

  it("returns true when more than 1 hour after scheduled", () => {
    expect(isLate("09:01", "08:00")).toBe(true)
    expect(isLate("09:30", "08:00")).toBe(true)
  })
})
