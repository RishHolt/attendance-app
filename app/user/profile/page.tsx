"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil } from "lucide-react"
import { UserPageLayout } from "@/components/user/user-page-layout"
import { PageSection } from "@/components/user/page-section"
import { Button } from "@/components/ui"
import { EditProfileModal } from "./edit-profile-modal"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  startDate: string | null
  role: "employee" | "admin" | "ojt"
  requiredHours: number | null
}

export default function UserProfilePage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [ojtHours, setOjtHours] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/me")
    const data = res.ok ? await res.json() : null
    setMe(data)
    if (data?.role === "ojt") {
      fetch("/api/me/ojt-progress")
        .then((r) => r.ok ? r.json() : null)
        .then((progress: { hoursCompleted: number } | null) => {
          if (progress) setOjtHours(progress.hoursCompleted)
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    loadProfile().finally(() => setIsLoading(false))
  }, [loadProfile])

  const handleEditSuccess = () => {
    loadProfile()
  }

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
    >
      <PageSection
        title="Profile information"
        action={
          me ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
              onClick={() => setEditModalOpen(true)}
              aria-label="Edit profile"
            >
              Edit
            </Button>
          ) : null
        }
      >
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
      </PageSection>

      {me?.role === "ojt" && me.requiredHours != null && (
        <PageSection title="Required Time Progress">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Hours completed</span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {ojtHours ?? 0} / {me.requiredHours} hrs
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`relative h-3 overflow-hidden rounded-full transition-all ${me.requiredHours > 0 && Math.min(100, Math.round(((ojtHours ?? 0) / me.requiredHours) * 100)) === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{
                  width: `${me.requiredHours > 0 ? Math.min(100, Math.round(((ojtHours ?? 0) / me.requiredHours) * 100)) : 0}%`,
                }}
              >
                <div className="animate-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </div>
            </div>
            <p className="text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {me.requiredHours > 0
                ? `${Math.min(100, Math.round(((ojtHours ?? 0) / me.requiredHours) * 100))}% complete`
                : ""}
            </p>
          </div>
        </PageSection>
      )}

      {me && (
        <EditProfileModal
          open={editModalOpen}
          user={me}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </UserPageLayout>
  )
}
