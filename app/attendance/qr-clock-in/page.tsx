import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QrClockInClient } from "./qr-clock-in-client"

export default async function QrClockInPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?returnTo=/attendance/qr-clock-in")
  }

  return <QrClockInClient />
}
