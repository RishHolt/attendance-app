"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

type DateTimeProps = {
  showIcon?: boolean
  className?: string
}

export const DateTime = ({ showIcon = true, className = "" }: DateTimeProps) => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <div
      className={`flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 ${className ?? ""}`.trim()}
      role="timer"
      aria-live="polite"
      aria-label={`Current date and time: ${dateStr}, ${timeStr}`}
      suppressHydrationWarning
    >
      {showIcon && <Clock className="h-4 w-4 shrink-0" aria-hidden />}
      <div className="flex flex-col items-end sm:flex-row sm:items-center sm:gap-2">
        <time
          dateTime={now.toISOString()}
          className="font-medium tabular-nums"
          suppressHydrationWarning
        >
          {timeStr}
        </time>
        <span className="hidden text-zinc-400 sm:inline dark:text-zinc-500">·</span>
        <time
          dateTime={now.toISOString().split("T")[0]}
          className="tabular-nums"
          suppressHydrationWarning
        >
          {dateStr}
        </time>
      </div>
    </div>
  )
}
