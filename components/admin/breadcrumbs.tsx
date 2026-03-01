"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

const pathLabels: Record<string, string> = {
  admin: "Dashboard",
  analytics: "Analytics",
  attendance: "Attendance",
  calendar: "Calendar",
  users: "Users",
  settings: "Settings",
  profile: "Profile",
}

const buildBreadcrumbs = (pathname: string) => {
  const segments = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean)
  const items = [{ href: "/admin", label: "Dashboard" }]

  let accumulated = "/admin"
  for (const segment of segments) {
    accumulated += `/${segment}`
    items.push({
      href: accumulated,
      label: pathLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
    })
  }

  return items
}

export const Breadcrumbs = () => {
  const pathname = usePathname()
  const items = buildBreadcrumbs(pathname)

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch]"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={item.href} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                aria-hidden
              />
            )}
            {isLast ? (
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
