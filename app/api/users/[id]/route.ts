import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth"
import type { UserRow } from "@/types"

export type { UserRow }

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized

    const body = (await _request.json()) as {
      fullName?: string
      email?: string
      contactNo?: string
      position?: string
      status?: "active" | "inactive"
      password?: string
      startDate?: string | null
      role?: string
    }

    if (body.password !== undefined && body.password?.trim()) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, unknown> = {}
    if (body.fullName !== undefined)
      updates.full_name = body.fullName.trim()
    if (body.email !== undefined)
      updates.email = body.email.trim().toLowerCase()
    if (body.contactNo !== undefined) {
      const trimmed = body.contactNo.trim()
      if (trimmed) {
        const digits = trimmed.replace(/\D/g, "")
        if (digits.length !== 11) {
          return NextResponse.json(
            { error: "Contact no must be exactly 11 digits" },
            { status: 400 }
          )
        }
      }
      updates.contact_no = trimmed || null
    }
    if (body.position !== undefined)
      updates.position = body.position.trim() || null
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      updates.status = body.status
    }
    if (body.startDate !== undefined) {
      updates.start_date = body.startDate?.trim() || null
    }
    if (body.role !== undefined) {
      const validRoles = ["employee", "admin", "ojt"]
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
      }
      updates.role = body.role
    }
    if ((body as { requiredHours?: number | null }).requiredHours !== undefined) {
      const rh = (body as { requiredHours?: number | null }).requiredHours
      updates.required_hours = rh != null ? Number(rh) : null
    }

    if (Object.keys(updates).length === 0 && !body.password?.trim()) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    if (body.password?.trim()) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", id)
        .single()
      if (existingUser?.email) {
        const admin = createAdminClient()
        const { data: listData } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })
        const authUser = listData.users.find(
          (u) => u.email?.toLowerCase() === existingUser.email.toLowerCase()
        )
        if (authUser) {
          const { error: authError } = await admin.auth.admin.updateUserById(
            authUser.id,
            { password: body.password.trim() }
          )
          if (authError) {
            return NextResponse.json(
              { error: authError.message ?? "Failed to update password" },
              { status: 500 }
            )
          }
        } else {
          const { data: createdAuth, error: createError } =
            await admin.auth.admin.createUser({
              email: existingUser.email,
              password: body.password.trim(),
              email_confirm: true,
              user_metadata: { full_name: existingUser.full_name },
            })
          if (createError) {
            return NextResponse.json(
              { error: createError.message ?? "Failed to create auth user" },
              { status: 500 }
            )
          }
        }
        const passwordHash = await bcrypt.hash(body.password.trim(), 10)
        updates.password_hash = passwordHash
      }
    }

    let data: {
      id: string
      user_id: string
      full_name: string
      email: string
      contact_no: string | null
      position: string | null
      status: string
      start_date: string | null
      role: string
    } | null

    if (Object.keys(updates).length > 0) {
      const result = await supabase
        .from("users")
        .update(updates)
        .eq("id", id)
        .select("id, user_id, full_name, email, contact_no, position, status, start_date, role, required_hours")
        .single()
      if (result.error) {
        if (result.error.code === "23505") {
          const detail = result.error.message.toLowerCase()
          if (detail.includes("email")) {
            return NextResponse.json({ error: "Email already exists" }, { status: 409 })
          }
        }
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        )
      }
      data = result.data
    } else {
      const result = await supabase
        .from("users")
        .select("id, user_id, full_name, email, contact_no, position, status, start_date, role, required_hours")
        .eq("id", id)
        .single()
      if (result.error) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 }
        )
      }
      data = result.data
    }

    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const user: UserRow = {
      id: data.id,
      userId: data.user_id,
      fullName: data.full_name,
      email: data.email,
      contactNo: data.contact_no,
      position: data.position,
      status: data.status as "active" | "inactive",
      startDate: data.start_date ?? null,
      role: (data.role ?? "employee") as "employee" | "admin" | "ojt",
      requiredHours: (data as Record<string, unknown>).required_hours as number | null ?? null,
    }

    return NextResponse.json(user)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    )
  }
}
