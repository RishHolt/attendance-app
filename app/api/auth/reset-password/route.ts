import { NextResponse } from "next/server"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = (body?.token ?? "").toString().trim()
    const password = (body?.password ?? "").toString()

    if (!token) {
      return NextResponse.json({ error: "Reset token is required" }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const tokenHash = createHash("sha256").update(token).digest("hex")

    // Use admin client throughout — user is not authenticated
    const admin = createAdminClient()

    // Look up the token
    const { data: tokenRow, error: tokenError } = await admin
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
    }

    if (tokenRow.used_at) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 })
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link has expired" }, { status: 400 })
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update password_hash in users table
    const { data: userRow, error: userError } = await admin
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", tokenRow.user_id)
      .select("id, email")
      .single()

    if (userError || !userRow) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
    }

    // Update Supabase auth password — look up auth user by email
    // (auth UUID may differ from users.id for users migrated from password_hash)
    try {
      const userEmail = (userRow.email as string).toLowerCase()
      const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const authUser = authList?.users?.find(
        (u) => u.email?.toLowerCase() === userEmail
      )
      if (authUser) {
        await admin.auth.admin.updateUserById(authUser.id, { password })
      }
    } catch {
      // Non-fatal — password_hash is already updated
    }

    // Mark token as used
    await admin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 }
    )
  }
}
