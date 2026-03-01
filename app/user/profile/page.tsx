"use client"

import { useEffect, useState } from "react"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { Card } from "@/components/ui"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  username: string | null
  contactNo: string | null
  position: string | null
  startDate: string | null
}

export default function UserProfilePage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .finally(() => setIsLoading(false))
  }, [])

  const formatDate = (s: string | null) => {
    if (!s) return "—"
    const d = new Date(s + "T12:00:00")
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <UserPageLayout
      title="Profile"
      description="View your profile information"
      showUserDetails={false}
    >
      <Card variant="default" padding="md">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading profile…</p>
          </div>
        ) : me ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Full name
              </dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{me.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Employee ID
              </dt>
              <dd className="mt-1 font-mono text-zinc-900 dark:text-zinc-100">{me.userId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Email
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{me.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Username
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {me.username ? `@${me.username}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Position
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{me.position || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Contact
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{me.contactNo || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Start date
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(me.startDate)}</dd>
            </div>
          </dl>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Failed to load profile.
          </p>
        )}
      </Card>
    </UserPageLayout>
  )
}
