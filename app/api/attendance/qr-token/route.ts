import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createQrToken } from "@/lib/qr-token"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const localAdminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
    const isAdmin =
      !!localAdminEmail &&
      user.email?.toLowerCase() === localAdminEmail.toLowerCase()

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const token = await createQrToken()
    if (!token) {
      return NextResponse.json(
        { error: "QR token secret not configured. Set QR_ATTENDANCE_SECRET or AUTH_SECRET in .env.local (min 32 chars)." },
        { status: 500 }
      )
    }

    return NextResponse.json({ token })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate token" },
      { status: 500 }
    )
  }
}
