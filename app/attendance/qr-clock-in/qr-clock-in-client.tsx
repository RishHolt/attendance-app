"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Loader2 } from "lucide-react"

const COOLDOWN_MINUTES = 60

const getTodayISO = () => {
  const d = new Date()
  return d.toISOString().split("T")[0] ?? ""
}

const getCurrentTime = () => {
  const d = new Date()
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const timeToMinutesSinceMidnight = (timeStr: string): number => {
  const parts = String(timeStr).trim().split(":")
  const h = parseInt(parts[0] ?? "0", 10)
  const m = parseInt(parts[1] ?? "0", 10)
  return h * 60 + m
}

const hasScheduleForToday = (rows: { customDate: string | null; dayOfWeek: number | null }[]) => {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const todayStr = today.toISOString().split("T")[0]
  const customMatch = rows.find((r) => r.customDate === todayStr)
  const recurringMatch = rows.find((r) => r.dayOfWeek === dayOfWeek)
  return !!(customMatch ?? recurringMatch)
}

export const QrClockInClient = () => {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "cooldown">("loading")
  const [message, setMessage] = useState("Clocking you in…")

  useEffect(() => {
    const run = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("token")
            : null
        if (token) {
          const verifyRes = await fetch(
            `/api/attendance/verify-qr-token?token=${encodeURIComponent(token)}`
          )
          const verifyData = await verifyRes.json().catch(() => ({}))
          if (!verifyData?.valid) {
            setMessage("Invalid or expired QR code. Please scan again.")
            setStatus("error")
            return
          }
        }

        const meRes = await fetch("/api/me")
        if (!meRes.ok) {
          const data = await meRes.json().catch(() => ({}))
          setMessage(data.error ?? "Unable to verify your account")
          setStatus("error")
          return
        }
        const meData = await meRes.json()
        const userId = meData.id
        const today = getTodayISO()
        const now = getCurrentTime()

        const [attRes] = await Promise.all([
          fetch(`/api/users/${userId}/attendances?from=${today}&to=${today}`),
        ])

        let attendance: { id: string; timeIn: string | null; timeOut: string | null } | null = null
        if (attRes.ok) {
          const data = await attRes.json()
          const list = data?.rows ?? (Array.isArray(data) ? data : [])
          attendance = list.length > 0 ? list[0] : null
        }

        if (attendance?.timeIn && attendance?.timeOut) {
          setMessage("You're already clocked in and out for today")
          setStatus("success")
          setTimeout(() => router.replace("/user"), 1500)
          return
        }

        if (attendance?.timeIn && !attendance?.timeOut) {
          const timeInMinutes = timeToMinutesSinceMidnight(attendance.timeIn)
          const nowMinutes = timeToMinutesSinceMidnight(now)
          const elapsedMinutes =
            nowMinutes >= timeInMinutes
              ? nowMinutes - timeInMinutes
              : 24 * 60 - timeInMinutes + nowMinutes
          if (elapsedMinutes < COOLDOWN_MINUTES) {
            const minutesLeft = COOLDOWN_MINUTES - elapsedMinutes
            setMessage(
              `You already scanned for time in. Come back in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} to scan for time out.`
            )
            setStatus("cooldown")
            return
          }
          const patchRes = await fetch(
            `/api/users/${userId}/attendances/${attendance.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ timeOut: now }),
            }
          )
          if (!patchRes.ok) {
            const data = await patchRes.json()
            setMessage(data.error ?? "Failed to time out")
            setStatus("error")
            return
          }
          setMessage("Clocked out successfully")
          setStatus("success")
          setTimeout(() => router.replace("/user"), 1500)
          return
        }

        if (attendance) {
          const patchRes = await fetch(
            `/api/users/${userId}/attendances/${attendance.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "present",
                timeIn: now,
                timeOut: attendance.timeOut ?? null,
              }),
            }
          )
          if (!patchRes.ok) {
            const data = await patchRes.json()
            setMessage(data.error ?? "Failed to time in")
            setStatus("error")
            return
          }
        } else {
          const postRes = await fetch(`/api/users/${userId}/attendances`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: today,
              status: "present",
              timeIn: now,
            }),
          })
          if (!postRes.ok) {
            const data = await postRes.json()
            setMessage(data.error ?? "Failed to time in")
            setStatus("error")
            return
          }
        }

        setMessage("Clocked in successfully")
        setStatus("success")
        setTimeout(() => router.replace("/user"), 1500)
      } catch {
        setMessage("Something went wrong")
        setStatus("error")
      }
    }

    run()
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
        {status === "loading" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-600 dark:text-zinc-400" />
            </div>
            <p className="mt-6 text-center font-medium text-zinc-900 dark:text-zinc-100">
              {message}
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Clock className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-6 text-center font-medium text-zinc-900 dark:text-zinc-100">
              {message}
            </p>
            <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Redirecting to dashboard…
            </p>
          </>
        )}
        {status === "cooldown" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-6 text-center font-medium text-zinc-900 dark:text-zinc-100">
              {message}
            </p>
            <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              You can scan again for time out after the cooldown.
            </p>
            <button
              type="button"
              onClick={() => router.push("/user")}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Go to dashboard
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <span className="text-2xl text-red-600 dark:text-red-400" aria-hidden>
                !
              </span>
            </div>
            <p className="mt-6 text-center font-medium text-zinc-900 dark:text-zinc-100">
              {message}
            </p>
            <button
              type="button"
              onClick={() => router.push("/user")}
              className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
