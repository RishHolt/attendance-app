"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Pencil, Trash2, User } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/admin/page-header"
import { swal } from "@/lib/swal"
import { EditProfileModal } from "./edit-profile-modal"

type MeUser = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  startDate: string | null
  avatarUrl: string | null
}

const formatDate = (s: string | null) => {
  if (!s) return "—"
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export default function AdminProfilePage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/me")
    const data = res.ok ? await res.json() : null
    setMe(data)
  }, [])

  useEffect(() => {
    setIsLoading(true)
    loadProfile().finally(() => setIsLoading(false))
  }, [loadProfile])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const res = await fetch("/api/me/avatar", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        swal.error(data.error ?? "Failed to upload photo")
        return
      }
      setMe((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev)
    } catch {
      swal.error("Failed to upload photo")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    const confirmed = await swal.confirm("Remove profile photo?", "Your profile photo will be removed.")
    if (!confirmed) return
    setIsUploadingAvatar(true)
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        swal.error(data.error ?? "Failed to remove photo")
        return
      }
      setMe((prev) => prev ? { ...prev, avatarUrl: null } : prev)
    } catch {
      swal.error("Failed to remove photo")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const initials = me?.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("") ?? ""

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card variant="default" padding="lg">
        <PageHeader
          title="Profile"
          description="View and manage your account details"
          actions={
            me ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => setEditOpen(true)}
              >
                Edit profile
              </Button>
            ) : null
          }
        />
      </Card>

      {isLoading ? (
        <Card variant="default" padding="lg">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading profile…</p>
          </div>
        </Card>
      ) : me ? (
        <>
          {/* Avatar + basic info */}
          <Card variant="default" padding="lg">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-24 w-24 overflow-hidden rounded-full bg-zinc-100 ring-4 ring-white dark:bg-zinc-800 dark:ring-zinc-900">
                  {me.avatarUrl ? (
                    <img
                      src={me.avatarUrl}
                      alt={me.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {initials ? (
                        <span className="text-2xl font-semibold text-zinc-500 dark:text-zinc-400">
                          {initials}
                        </span>
                      ) : (
                        <User className="h-10 w-10 text-zinc-400" aria-hidden />
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow-md transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  aria-label="Change profile photo"
                >
                  {isUploadingAvatar ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Name + quick info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{me.fullName}</h2>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{me.position || "—"}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{me.email}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    {me.avatarUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {me.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isUploadingAvatar}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Profile details */}
          <Card variant="default" padding="lg">
            <h3 className="mb-5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Profile information
            </h3>
            <dl className="grid gap-5 sm:grid-cols-2">
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
          </Card>
        </>
      ) : (
        <Card variant="default" padding="lg">
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Failed to load profile.
          </p>
        </Card>
      )}

      {me && (
        <EditProfileModal
          open={editOpen}
          user={me}
          onClose={() => setEditOpen(false)}
          onSuccess={loadProfile}
        />
      )}
    </div>
  )
}
