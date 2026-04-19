"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  Users,
  Menu,
  X,
  BarChart3,
} from "lucide-react"
import { DateTime } from "@/components/ui"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountDropdown } from "./account-dropdown"
import { Breadcrumbs } from "./breadcrumbs"
import { PageTransitionWrapper } from "@/components/page-transition-wrapper"
import { BrandLogo } from "@/components/brand-logo"

const sidebarNav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/admin/users", label: "Users", icon: Users },
]

type AdminShellProps = {
  children: React.ReactNode
  userName: string
}

export const AdminShell = ({ children, userName }: AdminShellProps) => {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  const sidebarContent = (
    <>
      <div className="flex justify-between items-center gap-3 px-5 border-zinc-200/80 dark:border-zinc-800/80 border-b h-16">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size={36} />
          <Link
            href="/admin"
            className="font-semibold text-zinc-900 dark:text-zinc-100 truncate tracking-tight"
          >
            Attendance System
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="lg:hidden flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg w-10 h-10 text-zinc-600 dark:text-zinc-400 shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex flex-col flex-1 gap-2 p-3 overflow-auto">
        {sidebarNav.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm dark:bg-blue-600 dark:text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive ? "" : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                }`}
                aria-hidden
              />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )

  return (
    <div className="flex bg-zinc-100/80 dark:bg-zinc-950 min-h-dvh">
      <div
        className={`fixed inset-0 z-40 bg-zinc-900/50 transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-zinc-200/80 bg-white shadow-xl transition-transform duration-300 ease-out lg:translate-x-0 lg:shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/50 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <div className="flex flex-col flex-1 lg:ml-64 min-w-0">
        <header className="top-0 z-10 sticky flex justify-between items-center gap-2 sm:gap-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-4 sm:px-6 border-zinc-200/80 dark:border-zinc-800/80 border-b h-16 shrink-0">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg w-10 h-10 text-zinc-600 dark:text-zinc-400 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <Breadcrumbs />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <DateTime className="hidden sm:flex" />
            <ThemeToggle />
            <AccountDropdown name={userName} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">
          <div className="mx-auto max-w-7xl min-w-0 w-full">
            <PageTransitionWrapper>
              {children}
            </PageTransitionWrapper>
          </div>
        </main>
      </div>
    </div>
  )
}
