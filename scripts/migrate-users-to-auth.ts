/**
 * Migrates existing users in the public.users table to Supabase Auth.
 * - Creates a Supabase auth account for each user that doesn't have one.
 * - Updates public.users.id to match the new auth UUID (keeps FKs consistent via cascade).
 * - Assigns a random temporary password — users must reset via Forgot Password.
 *
 * Run: npx tsx scripts/migrate-users-to-auth.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  // 1. Fetch all users from public.users
  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, email, full_name")
    .order("created_at", { ascending: true })

  if (usersError || !users) {
    console.error("Failed to fetch users:", usersError?.message)
    process.exit(1)
  }

  console.log(`Found ${users.length} user(s) in public.users\n`)

  // 2. Fetch all existing Supabase auth users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authEmails = new Set(
    (authData?.users ?? []).map((u) => u.email?.toLowerCase())
  )

  let created = 0
  let skipped = 0
  let failed = 0

  for (const user of users) {
    const email = (user.email as string).toLowerCase()

    if (authEmails.has(email)) {
      console.log(`[SKIP]    ${email} — already has auth account`)
      skipped++
      continue
    }

    // Generate a random temporary password
    const tempPassword = randomBytes(16).toString("hex")

    // Create Supabase auth user
    const { data: created_user, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    })

    if (createError || !created_user?.user) {
      console.error(`[FAIL]    ${email} — ${createError?.message}`)
      failed++
      continue
    }

    const newAuthId = created_user.user.id

    // Update public.users.id to match the new auth UUID
    // Uses a raw RPC call because .update().eq("id", ...) requires the old UUID
    const { error: updateError } = await admin.rpc("migrate_user_id", {
      old_id: user.id,
      new_id: newAuthId,
    })

    if (updateError) {
      // Fallback: direct update (works if no FK cascade issues)
      const { error: fallbackError } = await admin
        .from("users")
        .update({ id: newAuthId })
        .eq("id", user.id)

      if (fallbackError) {
        console.error(`[FAIL]    ${email} — auth created but could not update users.id: ${fallbackError.message}`)
        failed++
        continue
      }
    }

    console.log(`[CREATED] ${email} — auth UUID: ${newAuthId}`)
    created++
  }

  console.log(`\nDone. Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`)
  if (created > 0) {
    console.log("\nIMPORTANT: Migrated users have a random temporary password.")
    console.log("They must use 'Forgot password?' to set their own password before logging in.")
  }
}

main()
