"use client"

import { useEffect, useState } from "react"
import { User, Mail, Hash, Briefcase, Phone } from "lucide-react"
import { Card } from "@/components/ui"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  startDate: string | null
}

export const UserProfileCard = () => {
  const [me, setMe] = useState<MeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setMe(data)
        setIsLoading(false)
      })
      .catch(() => {
        setMe(null)
        setIsLoading(false)
      })
  }, [])

  if (isLoading) {
    return (
      <Card variant="default" padding="md">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </Card>
    )
  }

  if (!me) return null

  const rows: { icon: typeof User; label: string; value: string | null }[] = [
    { icon: Mail, label: "Email", value: me.email },
    { icon: Hash, label: "Employee ID", value: me.userId },
    { icon: Briefcase, label: "Position", value: me.position },
    { icon: Phone, label: "Contact", value: me.contactNo },
  ].filter((r) => r.value)

  return (
    <Card variant="default" padding="md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {me.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{me.fullName}</h2>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <dt className="sr-only">{label}</dt>
                <dd className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-500 dark:text-zinc-500">{label}:</span>{" "}
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Card>
  )
}
