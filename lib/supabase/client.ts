import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublicEnv } from "@/lib/env"

export const createClient = () => {
  const { url, anonKey } = getSupabasePublicEnv()
  return createBrowserClient(url, anonKey)
}
