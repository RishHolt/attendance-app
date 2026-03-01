import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const createAdminClient = () => {
  if (!supabaseUrl?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required. Add it to your .env.local file."
    )
  }
  if (!serviceRoleKey?.trim()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required. Add it to your .env.local file."
    )
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
