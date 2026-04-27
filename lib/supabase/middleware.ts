import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabasePublicEnv } from "@/lib/env"

// Per-process cache of user → role to avoid hitting the DB on every protected
// request. 60s TTL is short enough that role changes propagate quickly.
const ROLE_TTL_MS = 60_000
const roleCache = new Map<string, { role: string | null; expiresAt: number }>()

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url, anonKey } = getSupabasePublicEnv()
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin/* page routes — unauthenticated → login, non-admin → user area
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
    const isEnvAdmin = adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase()

    if (!isEnvAdmin) {
      let role: string | null
      const cached = roleCache.get(user.id)
      if (cached && cached.expiresAt > Date.now()) {
        role = cached.role
      } else {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()
        role = (data?.role as string | null) ?? null
        roleCache.set(user.id, { role, expiresAt: Date.now() + ROLE_TTL_MS })
      }
      if (role !== "admin") {
        return NextResponse.redirect(new URL("/user/attendance", request.url))
      }
    }
  }

  return supabaseResponse
}
