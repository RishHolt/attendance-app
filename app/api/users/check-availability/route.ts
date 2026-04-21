import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const field = searchParams.get("field")
    const value = searchParams.get("value")?.trim()
    const excludeId = searchParams.get("excludeId")

    if (!field || value === undefined || value === "") {
      return NextResponse.json({ available: true })
    }

    const validFields = ["email", "contactNo"]
    if (!validFields.includes(field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 })
    }

    const dbColumn =
      field === "contactNo" ? "contact_no" : "email"
    const searchValue = field === "email" ? value.toLowerCase() : value

    const supabase = await createClient()
    const unauthorized = await requireAdmin(supabase)
    if (unauthorized) return unauthorized
    let query = supabase.from("users").select("id").eq(dbColumn, searchValue)

    if (excludeId) {
      query = query.neq("id", excludeId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ available: !data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 }
    )
  }
}
