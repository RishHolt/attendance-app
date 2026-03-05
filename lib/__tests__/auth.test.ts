import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getAdminUser, requireAdmin } from "../auth"

type MockUser = { email: string } | null

function createMockSupabase(user: MockUser) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as unknown as Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>
}

describe("getAdminUser", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("returns null when user is not logged in", async () => {
    const supabase = createMockSupabase(null)
    const result = await getAdminUser(supabase)
    expect(result).toBe(null)
  })

  it("returns null when user email does not match LOCAL_ADMIN_EMAIL", async () => {
    const supabase = createMockSupabase({ email: "user@example.com" })
    const result = await getAdminUser(supabase)
    expect(result).toBe(null)
  })

  it("returns user when email matches LOCAL_ADMIN_EMAIL", async () => {
    const supabase = createMockSupabase({ email: "admin@example.com" })
    const result = await getAdminUser(supabase)
    expect(result).not.toBe(null)
    expect(result?.email).toBe("admin@example.com")
  })

  it("returns user when email matches case-insensitively", async () => {
    process.env.LOCAL_ADMIN_EMAIL = "Admin@Example.com"
    const supabase = createMockSupabase({ email: "admin@example.com" })
    const result = await getAdminUser(supabase)
    expect(result).not.toBe(null)
  })

  it("returns null when LOCAL_ADMIN_EMAIL is not set", async () => {
    delete process.env.LOCAL_ADMIN_EMAIL
    const supabase = createMockSupabase({ email: "admin@example.com" })
    const result = await getAdminUser(supabase)
    expect(result).toBe(null)
  })
})

describe("requireAdmin", () => {
  const originalEnv = process.env.LOCAL_ADMIN_EMAIL

  beforeEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = "admin@example.com"
  })

  afterEach(() => {
    process.env.LOCAL_ADMIN_EMAIL = originalEnv
  })

  it("returns null when user is admin", async () => {
    const supabase = createMockSupabase({ email: "admin@example.com" })
    const result = await requireAdmin(supabase)
    expect(result).toBe(null)
  })

  it("returns 401 NextResponse when user is not admin", async () => {
    const supabase = createMockSupabase({ email: "user@example.com" })
    const result = await requireAdmin(supabase)
    expect(result).not.toBe(null)
    expect(result?.status).toBe(401)
    const json = await result?.json()
    expect(json).toEqual({ error: "Unauthorized" })
  })

  it("returns 401 when user is null", async () => {
    const supabase = createMockSupabase(null)
    const result = await requireAdmin(supabase)
    expect(result?.status).toBe(401)
  })
})
