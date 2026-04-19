import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateFullName, validateEmail, validateContactNo, validatePassword } from "@/lib/user-form-validation"
import { checkUserAvailability } from "@/lib/check-user-availability"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, user_id, full_name, email, contact_no, position, start_date, avatar_url, status, role, required_hours")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const row = userRow as Record<string, unknown>
    return NextResponse.json({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      contactNo: row.contact_no ?? null,
      position: row.position ?? null,
      startDate: row.start_date ?? null,
      avatarUrl: row.avatar_url ?? null,
      status: row.status ?? "active",
      role: (row.role ?? "employee") as "employee" | "admin" | "ojt",
      requiredHours: (row.required_hours as number | null) ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get current user" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      fullName?: string
      email?: string
      contactNo?: string
      position?: string
      password?: string
    }

    const errors: Record<string, string> = {}
    if (body.fullName !== undefined) {
      const err = validateFullName(body.fullName)
      if (err) errors.fullName = err
    }
    if (body.email !== undefined) {
      const err = validateEmail(body.email)
      if (err) errors.email = err
    }
    if (body.contactNo !== undefined && body.contactNo.trim()) {
      const err = validateContactNo(body.contactNo)
      if (err) errors.contactNo = err
    }
    if (body.password !== undefined && body.password.trim()) {
      const err = validatePassword(body.password)
      if (err) errors.password = err
    }
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 422 })
    }

    // Check availability (skip own email/contact)
    if (body.email && body.email.trim().toLowerCase() !== userRow.email) {
      const { available } = await checkUserAvailability("email", body.email, userRow.id)
      if (!available) return NextResponse.json({ error: "Email already exists" }, { status: 409 })
    }
    if (body.contactNo?.trim()) {
      const { available } = await checkUserAvailability("contactNo", body.contactNo, userRow.id)
      if (!available) return NextResponse.json({ error: "Contact no already exists" }, { status: 409 })
    }

    const updates: Record<string, unknown> = {}
    if (body.fullName !== undefined) updates.full_name = body.fullName.trim()
    if (body.email !== undefined) updates.email = body.email.trim().toLowerCase()
    if (body.contactNo !== undefined) updates.contact_no = body.contactNo.trim() || null
    if (body.position !== undefined) updates.position = body.position.trim() || null

    if (body.password?.trim()) {
      const admin = createAdminClient()
      const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
        password: body.password.trim(),
      })
      if (authError) {
        return NextResponse.json({ error: authError.message ?? "Failed to update password" }, { status: 500 })
      }
      const passwordHash = await bcrypt.hash(body.password.trim(), 10)
      updates.password_hash = passwordHash
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userRow.id)
      .select("id, user_id, full_name, email, contact_no, position, start_date, avatar_url")
      .single()

    if (error) {
      if (error.code === "23505" && error.message.toLowerCase().includes("email")) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = data as Record<string, unknown>
    return NextResponse.json({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      contactNo: row.contact_no ?? null,
      position: row.position ?? null,
      startDate: row.start_date ?? null,
      avatarUrl: row.avatar_url ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 }
    )
  }
}
