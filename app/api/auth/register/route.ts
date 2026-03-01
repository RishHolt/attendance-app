import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const generateUserId = (): string =>
  String(Math.floor(Math.random() * 89999999) + 10000000)

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export async function POST(request: Request) {
  const registerUrl = new URL("/auth/register", request.url)
  const loginUrl = new URL("/auth/login", request.url)

  try {
    const formData = await request.formData()
    const fullName = formData.get("fullName")?.toString()?.trim() ?? ""
    const email = formData.get("email")?.toString()?.trim() ?? ""
    const password = formData.get("password")?.toString() ?? ""
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? ""
    const username = formData.get("username")?.toString()?.trim() ?? ""
    const contactNo = formData.get("contactNo")?.toString()?.trim() ?? ""
    const position = formData.get("position")?.toString()?.trim() ?? ""

    if (!fullName) {
      registerUrl.searchParams.set("error", "Full name is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!email) {
      registerUrl.searchParams.set("error", "Email is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!isEmail(email)) {
      registerUrl.searchParams.set("error", "Please enter a valid email address")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!password) {
      registerUrl.searchParams.set("error", "Password is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (password.length < 8) {
      registerUrl.searchParams.set("error", "Password must be at least 8 characters")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (password !== confirmPassword) {
      registerUrl.searchParams.set("error", "Passwords do not match")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!username) {
      registerUrl.searchParams.set("error", "Username is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (username.length < 3) {
      registerUrl.searchParams.set("error", "Username must be at least 3 characters")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!contactNo) {
      registerUrl.searchParams.set("error", "Contact no is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    const contactNoTrimmed = contactNo.replace(/\D/g, "")
    if (contactNoTrimmed.length !== 11) {
      registerUrl.searchParams.set("error", "Contact no must be exactly 11 digits")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    if (!position) {
      registerUrl.searchParams.set("error", "Position is required")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    const emailLower = email.toLowerCase()
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      if (
        authError.message?.toLowerCase().includes("already") ||
        authError.message?.toLowerCase().includes("registered")
      ) {
        registerUrl.searchParams.set("error", "An account with this email already exists")
        return NextResponse.redirect(registerUrl, { status: 302 })
      }
      registerUrl.searchParams.set("error", authError.message ?? "Registration failed")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    const authUserId = authData?.user?.id
    if (!authUserId) {
      registerUrl.searchParams.set("error", "Registration failed. Please try again.")
      return NextResponse.redirect(registerUrl, { status: 302 })
    }

    await admin.from("profiles").upsert(
      { id: authUserId, username },
      { onConflict: "id" }
    )

    const maxRetries = 5
    let lastError: { message: string } | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const userId = generateUserId()
      const { error: insertError } = await admin
        .from("users")
        .insert({
          id: authUserId,
          user_id: userId,
          full_name: fullName,
          username,
          email: emailLower,
          contact_no: contactNoTrimmed,
          position,
          status: "active",
        })

      if (!insertError) {
        const supabase = await createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password,
        })
        if (signInError) {
          loginUrl.searchParams.set(
            "message",
            "Account created successfully. Please sign in."
          )
          return NextResponse.redirect(loginUrl.toString(), { status: 302 })
        }
        const requestUrl = new URL(request.url)
        const userUrl = new URL("/user", requestUrl.origin)
        return NextResponse.redirect(userUrl.toString(), { status: 302 })
      }

      lastError = insertError
      if (insertError.code === "23505") {
        const detail = insertError.message.toLowerCase()
        if (detail.includes("email")) {
          registerUrl.searchParams.set("error", "An account with this email already exists")
          return NextResponse.redirect(registerUrl, { status: 302 })
        }
        if (detail.includes("username")) {
          registerUrl.searchParams.set("error", "Username is already taken")
          return NextResponse.redirect(registerUrl, { status: 302 })
        }
        if (detail.includes("user_id")) continue
      } else {
        break
      }
    }

    registerUrl.searchParams.set(
      "error",
      lastError?.message ?? "Registration failed. Please try again."
    )
    return NextResponse.redirect(registerUrl, { status: 302 })
  } catch (err) {
    registerUrl.searchParams.set("error", "Registration failed. Please try again.")
    return NextResponse.redirect(registerUrl, { status: 302 })
  }
}
