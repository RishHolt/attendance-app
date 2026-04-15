import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPasswordResetEmail } from "@/lib/mailer"
import { isEmail } from "@/lib/user-form-validation"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = (body?.email ?? "").toString().trim().toLowerCase()

    if (!email || !isEmail(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    // Use admin client to bypass RLS — user is not authenticated yet
    const admin = createAdminClient()

    // Look up user in users table — id column stores the auth UUID
    const { data: userRow } = await admin
      .from("users")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "No account found with that email address" }, { status: 404 })
    }

    // Generate secure token
    const rawToken = randomBytes(32).toString("hex")
    const tokenHash = createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Invalidate any prior unused tokens for this user
    await admin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userRow.id)
      .is("used_at", null)

    const { error: insertError } = await admin
      .from("password_reset_tokens")
      .insert({ user_id: userRow.id, token_hash: tokenHash, expires_at: expiresAt })

    if (insertError) {
      return NextResponse.json({ error: "Failed to create reset token" }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
    const resetUrl = `${appUrl}/auth/reset-password?token=${rawToken}`

    await sendPasswordResetEmail(email, resetUrl)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong" },
      { status: 500 }
    )
  }
}
