/**
 * Delete attendance record
 * Run: npx tsx scripts/delete-attendance.ts <attendanceId>
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const attendanceId = process.argv[2]
if (!attendanceId) {
  console.error("Usage: npx tsx scripts/delete-attendance.ts <attendanceId>")
  process.exit(1)
}

async function deleteAttendance() {
  console.log(`Deleting attendance ${attendanceId}...`)
  const { error } = await supabase
    .from("attendances")
    .delete()
    .eq("id", attendanceId)

  if (error) {
    console.error("Error:", error)
  } else {
    console.log("Deletion successful")
  }

  // Check if it still exists
  const { data, error: checkError } = await supabase
    .from("attendances")
    .select("*")
    .eq("id", attendanceId)
    .single()

  if (checkError) {
    if (checkError.code === 'PGRST116') {
      console.log("Confirmed: record no longer exists")
    } else {
      console.error("Error checking:", checkError)
    }
  } else {
    console.log("Record still exists:", data)
  }
}

deleteAttendance().catch(console.error)