import { describe, it, expect } from "vitest"
import { getWeekDateRange, getDefaultDateRange } from "../date-utils"

describe("getWeekDateRange", () => {
  it("returns Monday as 'from' and Sunday as 'to'", () => {
    // Wednesday 2026-04-08
    const { from, to } = getWeekDateRange(new Date("2026-04-08"))
    expect(from).toBe("2026-04-06") // Monday
    expect(to).toBe("2026-04-12")   // Sunday
  })

  it("handles Monday input — Monday is already start of week", () => {
    const { from, to } = getWeekDateRange(new Date("2026-04-06"))
    expect(from).toBe("2026-04-06")
    expect(to).toBe("2026-04-12")
  })

  it("handles Sunday input — Sunday is end of its own week", () => {
    const { from, to } = getWeekDateRange(new Date("2026-04-12"))
    expect(from).toBe("2026-04-06")
    expect(to).toBe("2026-04-12")
  })

  it("spans exactly 7 days", () => {
    const { from, to } = getWeekDateRange(new Date("2026-04-08"))
    const diff =
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
    expect(diff).toBe(6) // 6 days between Mon and Sun inclusive = 7 days total
  })

  it("returns the same week range on Tuesday and Thursday of the same week", () => {
    const tue = getWeekDateRange(new Date("2026-04-07"))
    const thu = getWeekDateRange(new Date("2026-04-09"))
    expect(tue.from).toBe(thu.from)
    expect(tue.to).toBe(thu.to)
  })

  it("crosses month boundaries correctly", () => {
    // Thursday 2026-04-30 — week spans into May
    const { from, to } = getWeekDateRange(new Date("2026-04-30"))
    expect(from).toBe("2026-04-27") // Monday
    expect(to).toBe("2026-05-03")   // Sunday
  })

  it("crosses year boundaries correctly", () => {
    // Wednesday 2026-12-30 — week spans into 2027
    const { from, to } = getWeekDateRange(new Date("2026-12-30"))
    expect(from).toBe("2026-12-28") // Monday
    expect(to).toBe("2027-01-03")   // Sunday
  })

  it("defaults to the current date when no argument is given", () => {
    const { from, to } = getWeekDateRange()
    // Just verify we get valid ISO date strings
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(from) <= new Date(to)).toBe(true)
  })
})

describe("getDefaultDateRange", () => {
  it("returns a 30-day range ending today", () => {
    const { from, to } = getDefaultDateRange()
    const today = new Date().toISOString().split("T")[0]
    expect(to).toBe(today)
    const diff =
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
    expect(diff).toBe(30)
  })
})
