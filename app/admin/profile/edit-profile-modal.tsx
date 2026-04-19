"use client"

import { useState, useEffect } from "react"
import { Modal, Button, Input, PasswordInput } from "@/components/ui"
import { swal } from "@/lib/swal"
import {
  validateFullName,
  validateEmail,
  validatePassword,
} from "@/lib/user-form-validation"

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

type EditProfileModalProps = {
  open: boolean
  user: MeUser | null
  onClose: () => void
  onSuccess?: () => void
}

export const EditProfileModal = ({ open, user, onClose, onSuccess }: EditProfileModalProps) => {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [contactNo, setContactNo] = useState("")
  const [position, setPosition] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user && open) {
      setFullName(user.fullName)
      setEmail(user.email)
      setContactNo(user.contactNo ?? "")
      setPosition(user.position ?? "")
      setPassword("")
      setConfirmPassword("")
      setFieldErrors({})
    }
  }, [user, open])

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const errors: Record<string, string> = {}
    const fullNameErr = validateFullName(fullName)
    if (fullNameErr) errors.fullName = fullNameErr
    const emailErr = validateEmail(email)
    if (emailErr) errors.email = emailErr

    if (password || confirmPassword) {
      if (!password || !confirmPassword) {
        errors.password = "Enter both password fields to change password"
      } else {
        const pwErr = validatePassword(password)
        if (pwErr) errors.password = pwErr
        else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match"
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, string> = { fullName, email, contactNo, position }
      if (password.trim()) body.password = password.trim()

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.errors) setFieldErrors(data.errors)
        swal.error(data.error ?? "Failed to update profile")
        return
      }
      await swal.success("Profile updated successfully")
      onClose()
      onSuccess?.()
    } catch {
      swal.error("Failed to update profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasChanges =
    !user ||
    fullName !== user.fullName ||
    email !== user.email ||
    contactNo !== (user.contactNo ?? "") ||
    position !== (user.position ?? "") ||
    password.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit profile"
      description="Update your profile details"
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="admin-edit-profile-form" className="flex-1" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id="admin-edit-profile-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Full name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName") }}
            error={fieldErrors.fullName}
          />
          <Input
            label="Email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError("email") }}
            error={fieldErrors.email}
          />
        </div>
        <Input
          label="Contact no"
          placeholder="e.g. 09171234567"
          type="tel"
          value={contactNo}
          onChange={(e) => { setContactNo(e.target.value); clearFieldError("contactNo") }}
          error={fieldErrors.contactNo}
        />
        <Input
          label="Position"
          placeholder="e.g. Developer, Manager"
          value={position}
          onChange={(e) => { setPosition(e.target.value); clearFieldError("position") }}
          error={fieldErrors.position}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PasswordInput
            label="New password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearFieldError("password") }}
            helperText="Leave blank to keep current password"
            error={fieldErrors.password}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword") }}
            error={fieldErrors.confirmPassword}
          />
        </div>
      </form>
    </Modal>
  )
}
