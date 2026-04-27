import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { admin: { createUser: vi.fn(), listUsers: vi.fn(), updateUserById: vi.fn() } },
  })),
}))

describe("GET /api/me", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns 401 when user is not logged in", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../me/route")
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })
})

describe("GET /api/attendances (admin)", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("returns 401 when user is not admin", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "regular@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../attendances/route")
    const req = new Request("http://localhost/api/attendances")
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })
})

describe("POST /api/attendances/mark-absent", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("returns 401 when user is not admin", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "employee@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { POST } = await import("../attendances/mark-absent/route")
    const req = new Request("http://localhost/api/attendances/mark-absent", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("processes > BATCH_SIZE (500) active users across multiple chunks", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    // Build 1100 active users (3 chunks: 500 + 500 + 100)
    const userIds = Array.from({ length: 1100 }, (_, i) => `u-${i}`)

    // Track per-table calls so we can assert chunked execution
    const scheduleInCalls: string[][] = []
    const existingInCalls: string[][] = []
    const upsertCalls: { user_id: string }[][] = []

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "or"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => makeChainable({ data: { role: "admin" }, error: null })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "users") {
          // Initial fetch of all active user ids
          const chain: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: userIds.map((id) => ({ id })), error: null }).then(resolve),
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            neq: vi.fn(() => chain),
          }
          return chain
        }
        if (table === "schedules") {
          // Capture which chunk was passed via .in()
          const chain: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
            select: vi.fn(() => chain),
            in: vi.fn((_col: string, ids: string[]) => {
              scheduleInCalls.push(ids)
              return chain
            }),
            or: vi.fn(() => chain),
          }
          return chain
        }
        if (table === "attendances") {
          // Two distinct shapes: existing-record SELECT (chained .in) and absent UPSERT.
          const chain: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
            select: vi.fn(() => chain),
            in: vi.fn((_col: string, ids: string[]) => {
              existingInCalls.push(ids)
              return chain
            }),
            eq: vi.fn(() => chain),
            upsert: vi.fn((rows: { user_id: string }[]) => {
              upsertCalls.push(rows)
              return Promise.resolve({ error: null })
            }),
          }
          return chain
        }
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { POST } = await import("../attendances/mark-absent/route")
    const req = new Request("http://localhost/api/attendances/mark-absent", { method: "POST" })
    const res = await POST(req)

    expect(res.status).toBe(200)
    // 1100 ids → chunks of 500/500/100 → 3 schedule fetches and 3 existing fetches
    expect(scheduleInCalls.length).toBe(3)
    expect(existingInCalls.length).toBe(3)
    expect(scheduleInCalls[0]).toHaveLength(500)
    expect(scheduleInCalls[1]).toHaveLength(500)
    expect(scheduleInCalls[2]).toHaveLength(100)
    // No schedule data → no absent rows → no upsert calls
    expect(upsertCalls.length).toBe(0)
  })
})

describe("POST /api/users/:id/attendances (user time-in)", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("allows an employee to time in for themselves", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    const mockInsert = vi.fn()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "att-1", user_id: "user-1", attendance_date: "2026-04-24", status: "present", time_in: "08:00", time_out: null },
      error: null,
    })
    mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "gte", "lte", "order", "range", "is", "single", "maybeSingle", "delete", "upsert"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "employee@example.com" } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1", role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "attendances") return { insert: mockInsert }
        if (table === "schedules") return makeChainable({ data: [], error: null })
        if (table === "users") return makeChainable({ data: { status: "active" }, error: null })
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { POST } = await import("../users/[id]/attendances/route")
    const req = new Request("http://localhost/api/users/user-1/attendances", {
      method: "POST",
      body: JSON.stringify({ date: "2026-04-24", timeIn: "08:00" }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: "user-1" }) })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.timeIn).toBe("08:00")
    expect(mockInsert).toHaveBeenCalled()
  })

  it("returns 401 when an employee tries to time in for a different user", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "employee@example.com" } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1", role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { POST } = await import("../users/[id]/attendances/route")
    const req = new Request("http://localhost/api/users/other-user/attendances", {
      method: "POST",
      body: JSON.stringify({ date: "2026-04-24", timeIn: "08:00" }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: "other-user" }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("allows creating attendance without schedule restriction (early time-in)", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    const mockInsert = vi.fn()
    const mockSelect = vi.fn()
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "att-1",
        user_id: "user-1",
        attendance_date: "2026-03-18",
        status: "present",
        time_in: "07:00",
        time_out: null,
      },
      error: null,
    })

    mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle,
      }),
    })

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "gte", "lte", "order", "range", "is", "single", "maybeSingle", "delete", "upsert"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => makeChainable({ data: { role: "admin" }, error: null })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "attendances") {
          return { insert: mockInsert, delete: vi.fn(() => makeChainable({ data: null, error: null })), upsert: vi.fn(() => makeChainable({ data: null, error: null })) }
        }
        if (table === "schedules") return makeChainable({ data: [], error: null })
        if (table === "users") return makeChainable({ data: { status: "active" }, error: null })
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { POST } = await import("../users/[id]/attendances/route")

    const req = new Request("http://localhost/api/users/user-1/attendances", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-03-18",
        timeIn: "07:00",
      }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: "user-1" }) })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.timeIn).toBe("07:00")
    expect(mockInsert).toHaveBeenCalled()
  })
})

describe("POST /api/users", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  function makeUserInsertMock(role: string) {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "user-uuid",
        user_id: "12345678",
        full_name: "Test User",
        email: "test@example.com",
        contact_no: "09123456789",
        position: "Developer",
        status: "active",
        role,
      },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    return { mockInsert, mockSelect, mockSingle }
  }

  it("creates user with role = 'admin' and returns it in response", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { mockInsert } = makeUserInsertMock("admin")

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ insert: mockInsert })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { POST } = await import("../users/route")
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Test User",
        email: "test@example.com",
        contactNo: "09123456789",
        position: "Developer",
        role: "admin",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.role).toBe("admin")
  })

  it("defaults role to 'employee' when role is omitted", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { mockInsert } = makeUserInsertMock("employee")

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ insert: mockInsert })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { POST } = await import("../users/route")
    const req = new Request("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Test User",
        email: "test@example.com",
        contactNo: "09123456789",
        position: "Developer",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.role).toBe("employee")
  })
})

describe("PATCH /api/users/:id/attendances/:attendanceId (user time-out)", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("allows an employee to time out for themselves", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "gte", "lte", "order", "range", "is", "single", "maybeSingle", "delete", "upsert", "update"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "employee@example.com" } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1", role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    let attendanceCallCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "attendances") {
          attendanceCallCount++
          if (attendanceCallCount === 1) {
            return makeChainable({
              data: { user_id: "user-1", attendance_date: "2026-04-24", time_in: "08:00", time_out: null },
              error: null,
            })
          }
          const chain = makeChainable(null)
          chain["update"] = vi.fn((u: Record<string, unknown>) =>
            makeChainable({
              data: { id: "att-1", user_id: "user-1", attendance_date: "2026-04-24", status: u.status, time_in: "08:00", time_out: "17:00", approval_status: null, remarks: null },
              error: null,
            })
          )
          return chain
        }
        if (table === "schedules") return makeChainable({ data: [{ time_in: "09:00", day_of_week: 5, custom_date: null }], error: null })
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { PATCH } = await import("../users/[id]/attendances/[attendanceId]/route")
    const req = new Request("http://localhost/api/users/user-1/attendances/att-1", {
      method: "PATCH",
      body: JSON.stringify({ timeOut: "17:00" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-1", attendanceId: "att-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.timeOut).toBe("17:00")
  })

  it("returns 401 when an employee tries to update another user's attendance", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "employee@example.com" } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1", role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { PATCH } = await import("../users/[id]/attendances/[attendanceId]/route")
    const req = new Request("http://localhost/api/users/other-user/attendances/att-1", {
      method: "PATCH",
      body: JSON.stringify({ timeOut: "17:00" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "other-user", attendanceId: "att-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 401 when an employee tries to set approvalStatus on their own record", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: "employee@example.com" } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1", role: "employee" }, error: null }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { PATCH } = await import("../users/[id]/attendances/[attendanceId]/route")
    const req = new Request("http://localhost/api/users/user-1/attendances/att-1", {
      method: "PATCH",
      body: JSON.stringify({ approvalStatus: "approved" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-1", attendanceId: "att-1" }) })
    expect(res.status).toBe(401)
  })

  it("allows admin to record time out and derives present status when timed in on time", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "gte", "lte", "order", "range", "is", "single", "maybeSingle", "delete", "upsert", "update"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => makeChainable({ data: { role: "admin" }, error: null })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    let capturedUpdates: Record<string, unknown> | null = null
    let attendanceCallCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "attendances") {
          attendanceCallCount++
          if (attendanceCallCount === 1) {
            // Fetch existing record (time_in present, no time_out)
            return makeChainable({
              data: { user_id: "user-1", attendance_date: "2026-04-24", time_in: "08:00", time_out: null },
              error: null,
            })
          }
          // Update record — capture what was written
          const mockUpdate = vi.fn((u: Record<string, unknown>) => {
            capturedUpdates = u
            return makeChainable({
              data: {
                id: "att-1", user_id: "user-1", attendance_date: "2026-04-24",
                status: u.status, time_in: "08:00", time_out: "17:00",
                approval_status: null, remarks: null,
              },
              error: null,
            })
          })
          const chain = makeChainable(null)
          chain["update"] = mockUpdate
          return chain
        }
        // Schedule: 09:00 on Fridays (2026-04-24 is a Friday, day_of_week=5)
        if (table === "schedules") {
          return makeChainable({
            data: [{ time_in: "09:00", day_of_week: 5, custom_date: null }],
            error: null,
          })
        }
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { PATCH } = await import("../users/[id]/attendances/[attendanceId]/route")
    const req = new Request("http://localhost/api/users/user-1/attendances/att-1", {
      method: "PATCH",
      body: JSON.stringify({ timeIn: "08:00", timeOut: "17:00" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-1", attendanceId: "att-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.timeOut).toBe("17:00")
    // 08:00 is 60 min early vs 09:00 schedule → within grace → present
    expect(capturedUpdates).toMatchObject({ status: "present", time_out: "17:00" })
    expect(json.status).toBe("present")
  })

  it("derives late status when timed in more than 60 minutes after schedule", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { createAdminClient } = await import("@/lib/supabase/admin")

    const makeChainable = (resolved: unknown) => {
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }
      for (const m of ["select", "eq", "neq", "in", "gte", "lte", "order", "range", "is", "single", "maybeSingle", "delete", "upsert", "update"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => makeChainable({ data: { role: "admin" }, error: null })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    let capturedUpdates: Record<string, unknown> | null = null
    let attendanceCallCount = 0
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "attendances") {
          attendanceCallCount++
          if (attendanceCallCount === 1) {
            // Existing record: clocked in 90 minutes late (10:30 vs 09:00 schedule)
            return makeChainable({
              data: { user_id: "user-1", attendance_date: "2026-04-24", time_in: "10:30", time_out: null },
              error: null,
            })
          }
          const mockUpdate = vi.fn((u: Record<string, unknown>) => {
            capturedUpdates = u
            return makeChainable({
              data: {
                id: "att-1", user_id: "user-1", attendance_date: "2026-04-24",
                status: u.status, time_in: "10:30", time_out: "17:00",
                approval_status: null, remarks: null,
              },
              error: null,
            })
          })
          const chain = makeChainable(null)
          chain["update"] = mockUpdate
          return chain
        }
        if (table === "schedules") {
          return makeChainable({
            data: [{ time_in: "09:00", day_of_week: 5, custom_date: null }],
            error: null,
          })
        }
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const { PATCH } = await import("../users/[id]/attendances/[attendanceId]/route")
    const req = new Request("http://localhost/api/users/user-1/attendances/att-1", {
      method: "PATCH",
      body: JSON.stringify({ timeOut: "17:00" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-1", attendanceId: "att-1" }) })
    expect(res.status).toBe(200)
    // 10:30 is 90 min after 09:00 schedule → exceeds 60 min grace → late
    expect(capturedUpdates).toMatchObject({ status: "late", time_out: "17:00" })
    await expect(res.json()).resolves.toMatchObject({ status: "late" })
  })
})

describe("GET /api/users", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  // Builds a mocked Supabase client whose `from("users")` returns a chainable
  // query that resolves to `resolved` when awaited (terminal `range()` or
  // direct await). Captures the chain calls so tests can assert on them.
  const makeUsersClient = (resolved: { data: unknown; error: unknown; count?: number }) => {
    const calls: { method: string; args: unknown[] }[] = []
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    }
    for (const m of ["select", "or", "eq", "order", "range"]) {
      chain[m] = vi.fn((...args: unknown[]) => {
        calls.push({ method: m, args })
        return chain
      })
    }
    return { chain, calls }
  }

  it("legacy mode returns a UserRow[] array when no ?page= is given", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { chain } = makeUsersClient({
      data: [
        {
          id: "u1",
          user_id: "10000001",
          full_name: "Alice",
          email: "alice@example.com",
          contact_no: "09111111111",
          position: "Dev",
          status: "active",
          start_date: null,
          end_date: null,
          role: "employee",
          required_hours: null,
          avatar_url: null,
        },
      ],
      error: null,
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: "admin@example.com" } }, error: null }),
      },
      from: vi.fn(() => chain),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../users/route")
    const req = new Request("http://localhost/api/users")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({ id: "u1", fullName: "Alice", role: "employee" })
  })

  it("paginated mode returns { rows, total, page, pageSize } when ?page= is given", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    const { chain, calls } = makeUsersClient({
      data: [
        {
          id: "u2",
          user_id: "10000002",
          full_name: "Bob",
          email: "bob@example.com",
          contact_no: null,
          position: null,
          status: "active",
          start_date: null,
          end_date: null,
          role: "employee",
          required_hours: null,
          avatar_url: null,
        },
      ],
      error: null,
      count: 42,
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: "admin@example.com" } }, error: null }),
      },
      from: vi.fn(() => chain),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../users/route")
    const req = new Request("http://localhost/api/users?page=2&pageSize=10&search=bo&role=employee")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ total: 42, page: 2, pageSize: 10 })
    expect(Array.isArray(json.rows)).toBe(true)
    expect(json.rows[0]).toMatchObject({ id: "u2", fullName: "Bob" })
    // page=2 with pageSize=10 → range(10, 19)
    const rangeCall = calls.find((c) => c.method === "range")
    expect(rangeCall?.args).toEqual([10, 19])
    // search and role filters were applied
    expect(calls.some((c) => c.method === "or")).toBe(true)
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "role")).toBe(true)
  })
})

describe("GET /api/schedules/summaries", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  const makeChainable = (resolved: unknown) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    }
    for (const m of ["select", "neq", "in", "or", "order", "range"]) {
      chain[m] = vi.fn(() => chain)
    }
    return chain
  }

  it("legacy mode returns a plain array when no ?page= is given", async () => {
    const { createClient } = await import("@/lib/supabase/server")

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "users") return makeChainable({ data: [{ id: "u1" }], error: null })
        if (table === "schedules") return makeChainable({ data: [], error: null })
        if (table === "user_schedule_defaults") return makeChainable({ data: [], error: null })
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../schedules/summaries/route")
    const req = new Request("http://localhost/api/schedules/summaries")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0]).toMatchObject({ userId: "u1", hasSchedule: false })
  })

  it("paginated mode returns { rows, total, page, pageSize } when ?page= is given", async () => {
    const { createClient } = await import("@/lib/supabase/server")

    const rangeCalls: [number, number][] = []
    const usersChain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: "u2" }], error: null, count: 87 }).then(resolve),
    }
    for (const m of ["select", "neq", "or", "order"]) usersChain[m] = vi.fn(() => usersChain)
    usersChain["range"] = vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to])
      return usersChain
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "users") return usersChain
        if (table === "schedules") return makeChainable({ data: [], error: null })
        if (table === "user_schedule_defaults") return makeChainable({ data: [], error: null })
        return makeChainable({ data: null, error: null })
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../schedules/summaries/route")
    const req = new Request("http://localhost/api/schedules/summaries?page=3&pageSize=20&search=alice")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ total: 87, page: 3, pageSize: 20 })
    expect(Array.isArray(json.rows)).toBe(true)
    // page=3 with pageSize=20 → range(40, 59)
    expect(rangeCalls[0]).toEqual([40, 59])
  })
})

describe("PATCH /api/users/[id]", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("updates user role and returns updated role in response", async () => {
    const { createClient } = await import("@/lib/supabase/server")

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "user-uuid",
        user_id: "12345678",
        full_name: "Test User",
        email: "test@example.com",
        contact_no: "09123456789",
        position: "Developer",
        status: "active",
        start_date: null,
        role: "ojt",
      },
      error: null,
    })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@example.com" } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ update: mockUpdate })),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { PATCH } = await import("../users/[id]/route")
    const req = new Request("http://localhost/api/users/user-uuid", {
      method: "PATCH",
      body: JSON.stringify({ role: "ojt" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "user-uuid" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.role).toBe("ojt")
  })
})
