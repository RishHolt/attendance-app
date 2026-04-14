/**
 * Check if attendance record exists
 * Run: npx tsx scripts/check-attendance.ts <attendanceId>
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
  console.error("Usage: npx tsx scripts/check-attendance.ts <attendanceId>")
  process.exit(1)
}

async function checkAttendance() {
  const { data, error } = await supabase
    .from("attendances")
    .select("*")
    .eq("id", attendanceId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      console.log(`Attendance record ${attendanceId} does not exist`)
    } else {
      console.error("Error:", error)
    }
  } else {
    console.log("Attendance record exists:", data)
  }
}

checkAttendance().catch(console.error)