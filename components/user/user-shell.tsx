"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  Menu,
  X,
} from "lucide-react"
import { DateTime } from "@/components/ui"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserAccountDropdown } from "./user-account-dropdown"
import { PageTransitionWrapper } from "@/components/page-transition-wrapper"
import { BrandLogo } from "@/components/brand-logo"

const headerNav = [
  { href: "/user", label: "Dashboard", icon: LayoutDashboard },
  { href: "/user/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/user/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/user/schedule", label: "Schedule", icon: CalendarRange },
]

type UserShellProps = {
  children: React.ReactNode
  userName: string
}

export const UserShell = ({ children, userName }: UserShellProps) => {
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [navOpen])

  const navLinkClass = (item: (typeof headerNav)[0]) => {
    const isActive =
      item.href === "/user"
        ? pathname === "/user"
        : pathname.startsWith(item.href)
    return `flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200 min-h-[44px] ${
      isActive
        ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    }`
  }

  return (
    <div className="flex flex-col bg-zinc-100/80 dark:bg-zinc-950 min-h-dvh">
      <div
        className={`fixed inset-0 z-40 bg-zinc-900/50 transition-opacity md:hidden ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200/80 bg-white shadow-xl transition-transform duration-300 ease-out md:hidden dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-zinc-950/50 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center gap-3 px-4 h-16 border-zinc-200/80 dark:border-zinc-800/80 border-b shrink-0">
          <Link
            href="/user"
            className="flex items-center gap-2"
            onClick={() => setNavOpen(false)}
          >
            <BrandLogo size={36} />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Attendance
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="md:hidden flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg w-11 h-11 min-w-[44px] min-h-[44px] text-zinc-600 dark:text-zinc-400 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav
          className="flex flex-col gap-2 p-3 overflow-auto flex-1"
          aria-label="Main navigation"
        >
          {headerNav.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(item)}
                onClick={() => setNavOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 sm:gap-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-3 sm:px-6 py-2 sm:py-0 h-14 sm:h-16 border-zinc-200/80 dark:border-zinc-800/80 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
              className="md:hidden flex justify-center items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg w-11 h-11 min-w-[44px] min-h-[44px] text-zinc-600 dark:text-zinc-400 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              href="/user"
              className="flex items-center gap-2 shrink-0 md:ml-0"
            >
              <BrandLogo size={36} />
              <span className="hidden sm:inline font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Attendance
              </span>
            </Link>
            <nav
              className="hidden md:flex items-center gap-1 lg:gap-2"
              aria-label="Main navigation"
            >
              {headerNav.map((item) => {
                const isActive =
                  item.href === "/user"
                    ? pathname === "/user"
                    : pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2.5 lg:px-3 text-sm font-medium transition-all duration-200 min-h-[44px] min-w-[44px] md:min-w-0 md:min-h-0 ${
                      isActive
                        ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <DateTime className="hidden sm:flex" />
            <ThemeToggle />
            <UserAccountDropdown name={userName} />
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-auto">
          <div className="mx-auto max-w-7xl w-full">
            <PageTransitionWrapper>
              {children}
            </PageTransitionWrapper>
          </div>
        </main>
      </div>
    </div>
  )
}
