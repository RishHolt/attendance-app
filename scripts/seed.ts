/**
 * Database seeder: 10 users with schedules and attendances
 * Run: npx tsx scripts/seed.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
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

const FAKE_NAMES = [
  "Alice Johnson",
  "Bob Smith",
  "Carol Williams",
  "David Brown",
  "Eve Davis",
  "Frank Miller",
  "Grace Wilson",
  "Henry Taylor",
  "Ivy Anderson",
  "Jack Martinez",
]

const POSITIONS = ["Developer", "Designer", "Manager", "Analyst", "Engineer"]

const generateUserId = () => String(Math.floor(Math.random() * 89999999) + 10000000)

function getWorkdaysInRange(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const d = new Date(from)
  while (d <= to) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function toTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

async function seed() {
  console.log("Seeding database…")

  const userIds = new Set<string>()
  const ensureUniqueUserId = () => {
    let id: string
    do id = generateUserId()
    while (userIds.has(id))
    userIds.add(id)
    return id
  }

  const runId = Date.now().toString(36).slice(-8)
  const usersToInsert = FAKE_NAMES.map((name, i) => ({
    full_name: name,
    email: `seed-${i + 1}-${runId}@example.com`,
    user_id: ensureUniqueUserId(),
    position: POSITIONS[i % POSITIONS.length],
    status: "active" as const,
    start_date: "2024-01-15",
  }))

  const { data: insertedUsers, error: usersError } = await supabase
    .from("users")
    .insert(usersToInsert)
    .select("id, user_id")

  if (usersError) {
    console.error("Failed to insert users:", usersError.message)
    process.exit(1)
  }

  console.log(`Inserted ${insertedUsers?.length ?? 0} users`)

  const userIdList = insertedUsers ?? []
  const now = new Date()
  const rangeEnd = new Date(now)
  const rangeStart = new Date(now)
  rangeStart.setDate(rangeStart.getDate() - 35)
  const workdays = getWorkdaysInRange(rangeStart, rangeEnd)

  for (const user of userIdList) {
    const uid = user.id as string

    await supabase.from("user_schedule_defaults").upsert(
      {
        user_id: uid,
        time_in: "09:00:00",
        time_out: "17:00:00",
        break_time: "12:00:00",
        break_duration: 1,
      },
      { onConflict: "user_id" }
    )

    const scheduleRows = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      user_id: uid,
      day_of_week: dayOfWeek,
      time_in: "09:00:00",
      time_out: "17:00:00",
      break_time: "12:00:00",
      break_duration: 1,
    }))

    await supabase.from("schedules").insert(scheduleRows)
  }

  console.log("Inserted schedules and user_schedule_defaults")

  const approvalStatuses = ["pending", "approved", "approved", "approved"] as const

  let attendanceCount = 0
  for (const user of userIdList) {
    const uid = user.id as string
    const attendances: Array<{
      user_id: string
      attendance_date: string
      status: string
      time_in: string | null
      time_out: string | null
      approval_status: string
    }> = []

    for (const day of workdays) {
      const dateStr = toISODate(day)
      const roll = Math.random()
      const status = roll < 0.75 ? "present" : roll < 0.9 ? "late" : "absent"
      const approvalStatus = approvalStatuses[Math.floor(Math.random() * approvalStatuses.length)]

      const isPresent = status === "present" || status === "late"
      const timeIn = isPresent ? (status === "late" ? "09:35:00" : "08:55:00") : null
      const timeOut = isPresent ? "17:10:00" : null

      attendances.push({
        user_id: uid,
        attendance_date: dateStr,
        status,
        time_in: timeIn,
        time_out: timeOut,
        approval_status: approvalStatus,
      })
    }

    const batchSize = 50
    for (let i = 0; i < attendances.length; i += batchSize) {
      const batch = attendances.slice(i, i + batchSize)
      const { error } = await supabase.from("attendances").insert(batch)
      if (error) {
        console.error(`Failed to insert attendances for user ${uid}:`, error.message)
      } else {
        attendanceCount += batch.length
      }
    }
  }

  console.log(`Inserted ${attendanceCount} attendances`)
  console.log("Seed complete.")
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
