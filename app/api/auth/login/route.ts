import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const resolveEmailFromLogin = async (login: string): Promise<string | null> => {
  const trimmed = login.trim()
  if (isEmail(trimmed)) return trimmed

  const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
  const localAdminUsername = process.env.LOCAL_ADMIN_USERNAME?.trim()
  if (
    localAdminEmail &&
    localAdminUsername &&
    trimmed.toLowerCase() === localAdminUsername.toLowerCase()
  ) {
    return localAdminEmail
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", trimmed)
    .maybeSingle()

  if (profile?.id) {
    const {
      data: { user },
    } = await admin.auth.admin.getUserById(profile.id)
    if (user?.email) return user.email
  }

  const { data: userRow } = await admin
    .from("users")
    .select("email")
    .ilike("username", trimmed)
    .maybeSingle()

  return userRow?.email ?? null
}

export async function POST(request: Request) {
  const loginUrl = new URL("/auth/login", request.url)
  const adminUrl = new URL("/admin", request.url)

  try {
    const formData = await request.formData()
    const login = formData.get("login")?.toString()?.trim() ?? ""
    const password = formData.get("password")?.toString() ?? ""

    if (!login) {
      loginUrl.searchParams.set("error", "Email or username is required")
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    if (!password) {
      loginUrl.searchParams.set("error", "Password is required")
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    let email: string | null
    const isLocalAdminLogin =
      process.env.LOCAL_ADMIN_USERNAME?.trim().toLowerCase() === login.toLowerCase()
    try {
      email = await resolveEmailFromLogin(login)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Configuration error"
      if (message.includes("required") || message.includes(".env")) {
        loginUrl.searchParams.set("error", "Server not configured")
        return NextResponse.redirect(loginUrl, { status: 302 })
      }
      throw err
    }

    if (!email) {
      loginUrl.searchParams.set("error", "Invalid email or username")
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      loginUrl.searchParams.set("error", error.message)
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    if (!data.user) {
      loginUrl.searchParams.set("error", "Sign in failed")
      return NextResponse.redirect(loginUrl, { status: 302 })
    }

    const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
    const isAdmin =
      isLocalAdminLogin ||
      (localAdminEmail &&
        data.user.email?.toLowerCase() === localAdminEmail.toLowerCase())

    const returnTo = formData.get("returnTo")?.toString()?.trim() ?? ""
    const isValidReturnTo =
      returnTo &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.includes("%0")

    const requestUrl = new URL(request.url)
    const isLocal = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1"
    const networkBase = process.env.NEXT_PUBLIC_QR_BASE_URL?.trim()?.replace(/\/$/, "")
    const redirectBase =
      isLocal && networkBase ? networkBase : requestUrl.origin

    const redirectUrl = isAdmin
      ? new URL("/admin", redirectBase)
      : isValidReturnTo
        ? new URL(returnTo, redirectBase)
        : new URL("/user", redirectBase)

    return NextResponse.redirect(redirectUrl.toString(), { status: 302 })
  } catch (err) {
    loginUrl.searchParams.set("error", "Sign in failed. Please try again.")
    return NextResponse.redirect(loginUrl, { status: 302 })
  }
}
