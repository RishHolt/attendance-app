"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { User, LogOut, ChevronDown } from "lucide-react"

type AccountDropdownProps = {
  name: string
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("")

export const AccountDropdown = ({ name }: AccountDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.avatarUrl) setAvatarUrl(data.avatarUrl) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const initials = getInitials(name)

  const avatar = () => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className="h-8 w-8 rounded-lg object-cover shrink-0"
        />
      )
    }
    return (
      <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700">
        {initials ? (
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{initials}</span>
        ) : (
          <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        )}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Account menu for ${name || "Account"}`}
        className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-2 py-2 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 sm:px-3 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        {avatar()}
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
          className="absolute right-0 top-full z-50 mt-2 w-56 min-w-[12rem] origin-top-right rounded-xl border border-zinc-200/80 bg-white py-1 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-zinc-950/50"
          role="menu"
        >
          <Link
            href="/admin/profile"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
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
