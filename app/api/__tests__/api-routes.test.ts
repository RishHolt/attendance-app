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
})

describe("POST /api/users/:id/attendances (user clock-in)", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    vi.resetModules()
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("allows creating attendance without schedule restriction (early time-in)", async () => {
    const { createClient } = await import("@/lib/supabase/server")

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
      for (const m of ["select", "eq", "in", "gte", "lte", "order", "range", "single", "maybeSingle"]) {
        chain[m] = vi.fn(() => chain)
      }
      return chain
    }

    const from = vi.fn((table: string) => {
      if (table === "attendances") {
        return {
          insert: mockInsert,
        }
      }
      if (table === "schedules") {
        return makeChainable({ data: [], error: null })
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    })

    vi.mocked(createClient).mockResolvedValue({
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

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
