"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { User, LogOut, ChevronDown } from "lucide-react"

type UserAccountDropdownProps = {
  name: string
}

export const UserAccountDropdown = ({ name }: UserAccountDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Account menu for ${name || "Account"}`}
        className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-2 py-2 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 sm:px-3 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700">
          <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        </div>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-zinc-900 sm:inline dark:text-zinc-100">
          {name || "Account"}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 sm:block ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 min-w-48 max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-zinc-950/50"
          role="menu"
        >
          <Link
            href="/user/profile"
            className="flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            <User className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            Profile
          </Link>
          <div className="my-1 border-t border-zinc-200/80 dark:border-zinc-700/80" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-3 min-h-[44px] text-left text-sm text-red-600 transition-colors hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/30 dark:active:bg-red-950/50"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
