import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { UserShell } from "@/components/user/user-shell"

export default async function UserLayout({
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

  return <UserShell userName={displayName}>{children}</UserShell>
}
