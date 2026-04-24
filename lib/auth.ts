import { NextResponse } from "next/server"

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

export async function getSessionUser(
  supabase: SupabaseClient
): Promise<{ id: string; role: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
  const isEnvAdmin = !!(adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase())

  const { data } = await supabase
    .from("users")
    .select("id, role")
    .eq("email", user.email.toLowerCase())
    .maybeSingle()

  if (!data) {
    if (isEnvAdmin) return { id: "__env_admin__", role: "admin" }
    return null
  }

  return { id: data.id as string, role: isEnvAdmin ? "admin" : (data.role as string) }
}

export async function getAdminUser(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  // .env admin always passes
  const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim()
  if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase()) return user

  // DB-level admin role
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("email", user.email.toLowerCase())
    .single()
  if (data?.role === "admin") return user

  return null
}

export async function requireAdmin(
  supabase: SupabaseClient
): Promise<NextResponse<unknown> | null> {
  const user = await getAdminUser(supabase)
  if (user) return null
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
