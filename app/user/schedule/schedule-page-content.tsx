"use client"

import { useEffect, useState } from "react"
import { CalendarRange, Loader2 } from "lucide-react"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { PageSection } from "@/components/user/page-section"
import { formatTime12 } from "@/lib/format-time"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

type ScheduleRow = {
  id: string
  dayOfWeek: number | null
  customDate: string | null
  timeIn: string
  timeOut: string
  breakTime: string | null
  breakDuration: number | null
}

export function SchedulePageContent() {
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const meRes = await fetch("/api/me")
      if (!meRes.ok) {
        setIsLoading(false)
        return
      }
      const meData = await meRes.json()
      setMe(meData)
      const schedRes = await fetch(`/api/users/${meData.id}/schedules`)
      if (schedRes.ok) {
        const data = await schedRes.json()
        const rows = data?.rows ?? []
        setSchedules(
          rows
            .filter((r: { dayOfWeek: number | null }) => r.dayOfWeek != null)
            .sort((a: ScheduleRow, b: ScheduleRow) => (a.dayOfWeek ?? 99) - (b.dayOfWeek ?? 99))
        )
      }
      setIsLoading(false)
    }
    load()
  }, [])

  return (
    <UserPageLayout
      title="Schedule"
      description="Your weekly work schedule"
    >
      <PageSection title="Weekly schedule">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading schedule…</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <CalendarRange className="h-7 w-7 text-zinc-400" aria-hidden />
            </div>
            <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-100">
              No schedule yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Your admin will assign your work schedule. Check back later.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Day
                  </th>
                  <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Time In
                  </th>
                  <th className="pb-3 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Time Out
                  </th>
                  <th className="pb-3 font-medium text-zinc-500 dark:text-zinc-400">Break</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/80 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {s.dayOfWeek != null ? WEEKDAYS[s.dayOfWeek] : s.customDate ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                      {formatTime12(s.timeIn)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                      {formatTime12(s.timeOut)}
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {s.breakTime
                        ? `${formatTime12(s.breakTime)} (${s.breakDuration ?? 0}h)`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </UserPageLayout>
  )
}
