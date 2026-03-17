import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
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
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const { GET } = await import("../attendances/route")
    const req = new Request("http://localhost/api/attendances")
    const res = await GET(req)
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

    const from = vi.fn((table: string) => {
      if (table === "attendances") {
        return {
          insert: mockInsert,
        }
      }
      if (table === "schedules") {
        return {
          select: vi.fn().mockResolvedValue({ data: [] }),
          eq: vi.fn().mockReturnThis(),
        }
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
