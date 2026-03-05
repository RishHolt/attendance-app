import { createClient } from "@/lib/supabase/server"
import { getAdminUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const adminUser = await getAdminUser(supabase)
  if (!adminUser) redirect("/user")

  const displayName =
    adminUser.user_metadata?.full_name ??
    adminUser.user_metadata?.name ??
    adminUser.email?.split("@")[0] ??
    "Account"

  return <AdminShell userName={displayName}>{children}</AdminShell>
}
