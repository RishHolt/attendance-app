import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isEmail } from "@/lib/user-form-validation"

const resolveEmailFromLogin = (login: string): string | null => {
  const trimmed = login.trim().toLowerCase()
  if (isEmail(trimmed)) return trimmed
  const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
  const localAdminUsername = process.env.LOCAL_ADMIN_USERNAME?.trim()
  if (
    localAdminEmail &&
    localAdminUsername &&
    trimmed === localAdminUsername.toLowerCase()
  ) {
    return localAdminEmail
  }
  return null
}

const isJsonRequest = (request: Request) =>
  request.headers.get("x-requested-with") === "XMLHttpRequest" ||
  request.headers.get("accept")?.includes("application/json")

export async function POST(request: Request) {
  const loginUrl = new URL("/auth/login", request.url)
  const jsonResponse = isJsonRequest(request)

  const respondError = (message: string, status = 400) => {
    if (jsonResponse) {
      return NextResponse.json({ error: message }, { status })
    }
    loginUrl.searchParams.set("error", message)
    return NextResponse.redirect(loginUrl.toString(), { status: 302 })
  }

  try {
    const formData = await request.formData()
    const login = formData.get("login")?.toString()?.trim() ?? ""
    const password = formData.get("password")?.toString() ?? ""

    if (!login) {
      return respondError("Email is required")
    }

    if (!password) {
      return respondError("Password is required")
    }

    const isLocalAdminLogin =
      process.env.LOCAL_ADMIN_USERNAME?.trim().toLowerCase() === login.trim().toLowerCase()
    const email = resolveEmailFromLogin(login)

    if (!email) {
      return respondError("Invalid email")
    }

    const supabase = await createClient()
    const admin = createAdminClient()

    // Try Supabase auth first
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    let userEmail = email
    let isAdmin = false

    if (error || !data.user) {
      // Fallback: check password_hash in users table (users without a Supabase auth account)
      const { data: userRow } = await admin
        .from("users")
        .select("id, email, password_hash, role")
        .ilike("email", email)
        .maybeSingle()

      if (!userRow?.password_hash) {
        return respondError("Invalid login credentials", 401)
      }

      const passwordMatch = await bcrypt.compare(password, userRow.password_hash)
      if (!passwordMatch) {
        return respondError("Invalid login credentials", 401)
      }

      userEmail = userRow.email as string
      isAdmin = userRow.role === "admin"
    } else {
      userEmail = data.user.email ?? email
      const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
      isAdmin =
        isLocalAdminLogin ||
        !!(localAdminEmail && userEmail.toLowerCase() === localAdminEmail.toLowerCase())

      if (!isAdmin) {
        const { data: userRecord } = await admin
          .from("users")
          .select("role")
          .ilike("email", userEmail)
          .single()
        if (userRecord?.role === "admin") isAdmin = true
      }
    }

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

    if (jsonResponse) {
      return NextResponse.json({ redirect: redirectUrl.toString() })
    }
    return NextResponse.redirect(redirectUrl.toString(), { status: 302 })
  } catch (err) {
    return respondError("Sign in failed. Please try again.", 500)
  }
}
