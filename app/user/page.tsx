import Link from "next/link"
import { CalendarCheck, CalendarDays, CalendarRange } from "lucide-react"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { Card } from "@/components/ui"

const secondaryLinkClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"

export default function UserDashboardPage() {
  return (
    <UserPageLayout
      title="Dashboard"
      description="Welcome back. View your attendance overview and quick actions."
      showUserDetails={true}
    >
      <Card variant="default" padding="md">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/user/attendance" className={secondaryLinkClass}>
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Clock in / out
          </Link>
          <Link href="/user/calendar" className={secondaryLinkClass}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            View calendar
          </Link>
          <Link href="/user/schedule" className={secondaryLinkClass}>
            <CalendarRange className="h-4 w-4" aria-hidden />
            My schedule
          </Link>
        </div>
      </Card>
    </UserPageLayout>
  )
}
