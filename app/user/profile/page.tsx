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
}

export default function UserProfilePage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/me")
    const data = res.ok ? await res.json() : null
    setMe(data)
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
