import { Suspense } from "react"
import { UserCalendarPageContent } from "./calendar-page-content"

export default function UserCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white py-16 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading calendar…</p>
        </div>
      }
    >
      <UserCalendarPageContent />
    </Suspense>
  )
}
