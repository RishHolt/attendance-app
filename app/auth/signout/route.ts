import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL(request.url)
  return NextResponse.redirect(new URL("/auth/login", url.origin), {
    status: 302,
  })
}
