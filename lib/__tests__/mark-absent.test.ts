import { describe, it, expect } from "vitest"
import { isFutureDate, getDayOfWeek, resolveAbsentUserIds } from "../mark-absent"

describe("isFutureDate", () => {
  it("returns true for a date after today", () => {
    expect(isFutureDate("2030-01-01", "2026-04-08")).toBe(true)
  })

  it("returns false for today", () => {
    expect(isFutureDate("2026-04-08", "2026-04-08")).toBe(false)
  })

  it("returns false for a past date", () => {
    expect(isFutureDate("2025-01-01", "2026-04-08")).toBe(false)
  })
})

describe("getDayOfWeek", () => {
  it("returns 3 (Wednesday) for 2026-04-08", () => {
    expect(getDayOfWeek("2026-04-08")).toBe(3)
  })

  it("returns 1 (Monday) for 2026-04-06", () => {
    expect(getDayOfWeek("2026-04-06")).toBe(1)
  })

  it("returns 0 (Sunday) for 2026-04-12", () => {
    expect(getDayOfWeek("2026-04-12")).toBe(0)
  })
})

describe("resolveAbsentUserIds", () => {
  const date = "2026-04-08" // Wednesday = day_of_week 3

  const schedWed = (userId: string, timeOut = "17:00") => ({
    user_id: userId,
    day_of_week: 3,
    custom_date: null,
    time_out: timeOut,
  })

  const schedCustom = (userId: string, timeOut = "17:00") => ({
    user_id: userId,
    day_of_week: null,
    custom_date: date,
    time_out: timeOut,
  })

  // --- Past date (nowTime = null) ---

  it("marks a user absent when past date, scheduled, no record", () => {
    expect(
      resolveAbsentUserIds(["u1"], [schedWed("u1")], [], date, null),
    ).toEqual(["u1"])
  })

  it("skips a user who already has an attendance record (idempotent)", () => {
    expect(
      resolveAbsentUserIds(["u1"], [schedWed("u1")], [{ user_id: "u1" }], date, null),
    ).toEqual([])
  })

  it("skips an inactive user (not in activeUserIds)", () => {
    expect(
      resolveAbsentUserIds([], [schedWed("u-inactive")], [], date, null),
    ).toEqual([])
  })

  it("skips a user whose schedule day_of_week does not match", () => {
    // day_of_week 1 = Monday, date is Wednesday
    expect(
      resolveAbsentUserIds(
        ["u1"],
        [{ user_id: "u1", day_of_week: 1, custom_date: null, time_out: "17:00" }],
        [],
        date,
        null,
      ),
    ).toEqual([])
  })

  it("marks a user absent via custom_date schedule (past date)", () => {
    expect(
      resolveAbsentUserIds(["u1"], [schedCustom("u1")], [], date, null),
    ).toEqual(["u1"])
  })

  it("skips a user with a custom_date that does not match targetDate", () => {
    expect(
      resolveAbsentUserIds(
        ["u1"],
        [{ user_id: "u1", day_of_week: null, custom_date: "2026-04-09", time_out: "17:00" }],
        [],
        date,
        null,
      ),
    ).toEqual([])
  })

  it("handles multiple users — marks only unrecorded scheduled users", () => {
    const result = resolveAbsentUserIds(
      ["u1", "u2", "u3", "u4"],
      [
        schedWed("u1"), // scheduled, already recorded
        schedWed("u2"), // scheduled, not recorded
        { user_id: "u3", day_of_week: 1, custom_date: null, time_out: "17:00" }, // wrong day
        // u4 has no schedule
      ],
      [{ user_id: "u1" }],
      date,
      null,
    )
    expect(result).toEqual(["u2"])
  })

  it("returns empty when no active users have a schedule", () => {
    expect(resolveAbsentUserIds(["u1", "u2"], [], [], date, null)).toEqual([])
  })

  it("deduplicates when multiple schedule rows match the same user", () => {
    const result = resolveAbsentUserIds(
      ["u1"],
      [schedWed("u1", "17:00"), schedCustom("u1", "18:00")],
      [],
      date,
      null,
    )
    expect(result).toEqual(["u1"])
    expect(result.length).toBe(1)
  })

  // --- Today (nowTime provided) ---

  it("marks absent when current time is after the scheduled time_out", () => {
    // shift ends at 17:00, now is 17:30
    expect(
      resolveAbsentUserIds(["u1"], [schedWed("u1", "17:00")], [], date, "17:30"),
    ).toEqual(["u1"])
  })

  it("marks absent when current time exactly equals the scheduled time_out", () => {
    expect(
      resolveAbsentUserIds(["u1"], [schedWed("u1", "17:00")], [], date, "17:00"),
    ).toEqual(["u1"])
  })

  it("does NOT mark absent when current time is before the scheduled time_out", () => {
    // shift ends at 17:00, now is 09:00
    expect(
      resolveAbsentUserIds(["u1"], [schedWed("u1", "17:00")], [], date, "09:00"),
    ).toEqual([])
  })

  it("uses the latest time_out when user has multiple schedule rows for that day", () => {
    // Two rows: 12:00 and 17:00 — should wait until the latest (17:00)
    const result = resolveAbsentUserIds(
      ["u1"],
      [schedWed("u1", "12:00"), schedWed("u1", "17:00")],
      [],
      date,
      "13:00", // past 12:00 but before 17:00
    )
    expect(result).toEqual([]) // not yet — latest shift hasn't ended
  })

  it("marks absent after the latest time_out has passed", () => {
    const result = resolveAbsentUserIds(
      ["u1"],
      [schedWed("u1", "12:00"), schedWed("u1", "17:00")],
      [],
      date,
      "18:00", // past both shifts
    )
    expect(result).toEqual(["u1"])
  })

  it("does NOT mark absent when user has an incomplete record (timed-in, no time-out)", () => {
    // The query returns all records regardless of status — incomplete counts as "already recorded"
    expect(
      resolveAbsentUserIds(
        ["u1"],
        [schedWed("u1", "17:00")],
        [{ user_id: "u1" }], // incomplete row exists in DB
        date,
        "18:00",
      ),
    ).toEqual([])
  })

  it("handles DB time_out with seconds (HH:MM:SS format)", () => {
    expect(
      resolveAbsentUserIds(
        ["u1"],
        [{ user_id: "u1", day_of_week: 3, custom_date: null, time_out: "17:00:00" }],
        [],
        date,
        "17:30",
      ),
    ).toEqual(["u1"])
  })
})
