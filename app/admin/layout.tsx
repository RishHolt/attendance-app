import { createClient } from "@/lib/supabase/server"
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

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Account"

  return <AdminShell userName={displayName}>{children}</AdminShell>
}
