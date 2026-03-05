import { NextResponse } from "next/server"

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

export async function getAdminUser(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
  if (!adminEmail) return null
  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) return null
  return user
}

export async function requireAdmin(
  supabase: SupabaseClient
): Promise<NextResponse<unknown> | null> {
  const user = await getAdminUser(supabase)
  if (user) return null
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
