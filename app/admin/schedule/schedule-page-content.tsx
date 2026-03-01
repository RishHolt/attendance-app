"use client"

import { useCallback, useEffect, useState } from "react"
import { Calendar, Search, Users } from "lucide-react"
import { Button, Card, Input } from "@/components/ui"
import { PageHeader } from "@/components/admin/page-header"
import { ManageScheduleModal } from "./manage-schedule-modal"
import type { ScheduleSummary } from "@/app/api/schedules/summaries/route"

type UserRow = {
  id: string
  userId: string
  fullName: string
  username: string | null
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
}

const fetchUsers = async (): Promise<UserRow[]> => {
  const res = await fetch("/api/users")
  if (!res.ok) return []
  return res.json()
}

const fetchScheduleSummaries = async (): Promise<ScheduleSummary[]> => {
  const res = await fetch("/api/schedules/summaries")
  if (!res.ok) return []
  return res.json()
}

type TabValue = "all" | "no-schedule"

export const SchedulePageContent = () => {
  const [users, setUsers] = useState<UserRow[]>([])
  const [summaries, setSummaries] = useState<ScheduleSummary[]>([])
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<TabValue>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [manageUser, setManageUser] = useState<UserRow | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [usersData, summariesData] = await Promise.all([
      fetchUsers(),
      fetchScheduleSummaries(),
    ])
    setUsers(usersData)
    setSummaries(summariesData)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const summaryMap = new Map(summaries.map((s) => [s.userId, s]))

  const filteredUsers = users
    .filter((u) => {
      if (tab === "no-schedule") return !summaryMap.get(u.id)?.hasSchedule
      return true
    })
    .filter((u) => {
      const q = search.toLowerCase()
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username?.toLowerCase().includes(q) ?? false) ||
        (u.contactNo?.toLowerCase().includes(q) ?? false) ||
        (u.position?.toLowerCase().includes(q) ?? false)
      )
    })

  const handleManageSchedule = (user: UserRow) => setManageUser(user)
  const handleCloseModal = () => {
    setManageUser(null)
    loadData()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Manage work schedules by user"
      />

      <Card variant="default" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-4 flex border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              { value: "all" as TabValue, label: "All" },
              { value: "no-schedule" as TabValue, label: "No schedule" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-label={`Show ${label} users`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setTab(value)
                }
              }}
              className={`flex-1 pb-3 pt-1 text-sm font-medium transition-colors ${
                tab === value
                  ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "-mb-px border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading users…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Users className="h-8 w-8 text-zinc-400" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {users.length === 0
                  ? "No users yet"
                  : tab === "no-schedule"
                    ? "All users have schedules"
                    : "No results found"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                {users.length === 0
                  ? "Add users first, then manage their schedules"
                  : tab === "no-schedule"
                    ? "Every user has at least one day scheduled"
                    : "Try a different search term or tab"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredUsers.map((user) => {
                const s = summaryMap.get(user.id)
                const summaryParts =
                  s?.hasSchedule && s.summary
                    ? s.summary.split(" · ")
                    : ["No schedule"]
                return (
                  <div
                    key={user.id}
                    className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
                  >
                    <div className="flex min-h-0 flex-1 flex-col gap-3">
                      <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {user.fullName}
                        </p>
                        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                          {user.email}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {user.userId && <span className="font-mono">ID: {user.userId}</span>}
                          {user.position && <span>{user.position}</span>}
                          {user.contactNo && <span>{user.contactNo}</span>}
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {user.status}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-0.5">
                          {summaryParts.map((part, i) => (
                            <p
                              key={i}
                              className={`text-xs ${
                                s?.hasSchedule && s.summary
                                  ? "text-zinc-600 dark:text-zinc-400"
                                  : "italic text-zinc-400 dark:text-zinc-500"
                              }`}
                              title="Schedule"
                            >
                              {part}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    </div>
                    <div className="mt-4 shrink-0">
                      <Button
                        variant="secondary"
                        leftIcon={<Calendar className="h-4 w-4" />}
                        className="w-full"
                        onClick={() => handleManageSchedule(user)}
                      >
                        Manage schedule
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <ManageScheduleModal
        open={!!manageUser}
        user={manageUser}
        onClose={handleCloseModal}
      />
    </div>
  )
}
