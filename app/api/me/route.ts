import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, user_id, full_name, email, contact_no, position, start_date")
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
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get current user" },
      { status: 500 }
    )
  }
}
