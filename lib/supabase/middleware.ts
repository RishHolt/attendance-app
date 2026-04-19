import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabasePublicEnv } from "@/lib/env"

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
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("email", user.email!.toLowerCase())
        .single()
      if (data?.role !== "admin") {
        return NextResponse.redirect(new URL("/user/attendance", request.url))
      }
    }
  }

  return supabaseResponse
}
