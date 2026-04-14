import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth"
import type { UserRow } from "@/types"

export type { UserRow }

const generateUserId = (): string =>
  String(Math.floor(Math.random() * 89999999) + 10000000)

export async function GET() {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const withStartDate = await supabase
      .from("users")
      .select("id, user_id, full_name, email, contact_no, position, status, start_date, role")
      .order("created_at", { ascending: false })

    const msg = String(withStartDate.error?.message ?? "").toLowerCase()
    const useFallback = withStartDate.error && (msg.includes("start_date") || msg.includes("column"))

    const result = useFallback
      ? await supabase
          .from("users")
          .select("id, user_id, full_name, email, contact_no, position, status, role")
          .order("created_at", { ascending: false })
      : withStartDate

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    const rows = (result.data ?? []) as Array<Record<string, unknown> & { start_date?: string | null }>
    const users: UserRow[] = rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      fullName: String(row.full_name),
      email: String(row.email),
      contactNo: row.contact_no as string | null,
      position: row.position as string | null,
      status: row.status as "active" | "inactive",
      startDate: (row.start_date as string | null) ?? null,
      role: ((row.role as string | null) ?? "employee") as "employee" | "admin" | "ojt",
    }))

    return NextResponse.json(users)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { fullName, email, contactNo, position, password, role } = body as {
      fullName?: string
      email?: string
      contactNo?: string
      position?: string
      password?: string
      role?: string
    }

    if (!fullName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      )
    }

    if (!contactNo?.trim()) {
      return NextResponse.json(
        { error: "Contact no is required" },
        { status: 400 }
      )
    }

    const contactNoTrimmed = contactNo.trim().replace(/\D/g, "")
    if (contactNoTrimmed.length !== 11) {
      return NextResponse.json(
        { error: "Contact no must be exactly 11 digits" },
        { status: 400 }
      )
    }

    if (!position?.trim()) {
      return NextResponse.json(
        { error: "Position is required" },
        { status: 400 }
      )
    }

    const emailLower = email.trim().toLowerCase()

    if (password?.trim()) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        )
      }
    }

    const validRoles = ["employee", "admin", "ojt"]
    const resolvedRole = role && validRoles.includes(role) ? role : "employee"

    let authUserId: string | null = null
    let passwordHash: string | null = null
    if (password?.trim()) {
      try {
        const admin = createAdminClient()
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: emailLower,
          password: password.trim(),
          email_confirm: true,
          user_metadata: { full_name: fullName.trim() },
        })
        if (authError) {
          if (authError.message?.toLowerCase().includes("already been registered")) {
            return NextResponse.json({ error: "Email already exists" }, { status: 409 })
          }
          return NextResponse.json(
            { error: authError.message ?? "Failed to create auth user" },
            { status: 500 }
          )
        }
        authUserId = authData?.user?.id ?? null
        passwordHash = await bcrypt.hash(password.trim(), 10)
      } catch (authErr: unknown) {
        const err = authErr as { message?: string }
        return NextResponse.json(
          { error: err?.message ?? "Failed to create auth user" },
          { status: 500 }
        )
      }
    }

    const admin = createAdminClient()
    const maxRetries = 5
    let lastError: { message: string; code?: string } | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const userId = generateUserId()
      const insertPayload = {
        ...(authUserId ? { id: authUserId } : {}),
        user_id: userId,
        full_name: fullName.trim(),
        email: emailLower,
        contact_no: contactNoTrimmed,
        position: position.trim(),
        status: "active",
        role: resolvedRole,
        ...(passwordHash ? { password_hash: passwordHash } : {}),
      }
      const clientToUse = authUserId ? admin : supabase
      const { data, error } = await clientToUse
        .from("users")
        .insert(insertPayload)
        .select("id, user_id, full_name, email, contact_no, position, status, role")
        .single()

      if (!error) {
        const user: UserRow = {
          id: data.id,
          userId: data.user_id,
          fullName: data.full_name,
          email: data.email,
          contactNo: data.contact_no,
          position: data.position,
          status: data.status as "active" | "inactive",
          startDate: null,
          role: (data.role ?? "employee") as "employee" | "admin" | "ojt",
        }
        return NextResponse.json(user, { status: 201 })
      }

      lastError = error
      if (error.code === "23505") {
        const detail = error.message.toLowerCase()
        if (detail.includes("email")) {
          return NextResponse.json({ error: "Email already exists" }, { status: 409 })
        }
        if (detail.includes("user_id")) continue
      } else {
        break
      }
    }

    return NextResponse.json(
      { error: lastError?.message ?? "Failed to create user" },
      { status: 500 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    )
  }
}
