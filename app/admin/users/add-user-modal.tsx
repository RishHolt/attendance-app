"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { swal } from "@/lib/swal"
import {
  validateUserForm,
} from "@/lib/user-form-validation"
import { checkUserAvailability } from "@/lib/check-user-availability"

type AddUserModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const AddUserModal = ({ open, onClose, onSuccess }: AddUserModalProps) => {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [contactNo, setContactNo] = useState("")
  const [position, setPosition] = useState("")
  const [role, setRole] = useState<"employee" | "admin" | "ojt">("employee")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
    const array = new Uint8Array(12)
    crypto.getRandomValues(array)
    const generated = Array.from(array)
      .map((b) => chars[b % chars.length])
      .join("")
    setPassword(generated)
    setConfirmPassword(generated)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.password
      delete next.confirmPassword
      return next
    })
  }

  const resetForm = () => {
    setFullName("")
    setEmail("")
    setContactNo("")
    setPosition("")
    setRole("employee")
    setPassword("")
    setConfirmPassword("")
    setFieldErrors({})
  }

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm()
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateUserForm({
      fullName,
      email,
      contactNo,
      position,
      password,
      confirmPassword,
    })
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }
    // Check availability before submitting
    const availErrors: Record<string, string> = {}
    try {
      const [emailCheck, contactCheck] = await Promise.all([
        checkUserAvailability("email", email),
        checkUserAvailability("contactNo", contactNo),
      ])
      if (!emailCheck.available) availErrors.email = "Email already exists"
      if (!contactCheck.available) availErrors.contactNo = "Contact no already exists"
    } catch {
      // proceed; server will catch duplicates
    }
    if (Object.keys(availErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...availErrors }))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          contactNo,
          position,
          role,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data.error ?? "Failed to create user"
        swal.error(errMsg)
        return
      }
      await swal.success("User created successfully")
      resetForm()
      onClose()
      onSuccess?.()
    } catch {
      swal.error("Failed to create user")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add user"
      description="Create a new user account in the system"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-user-form"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating…" : "Create user"}
          </Button>
        </div>
      }
    >
      <form
        id="add-user-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
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
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="add-user-role">
            Role
          </label>
          <select
            id="add-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "employee" | "admin" | "ojt")}
            className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          >
            <option value="employee">Employee</option>
            <option value="ojt">OJT / Intern</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
            <button
              type="button"
              onClick={generatePassword}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Generate password
            </button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-start">
            <PasswordInput
              id="add-user-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password") }}
              helperText="Minimum 8 characters"
              error={fieldErrors.password}
            />
            <PasswordInput
              id="add-user-confirm-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword") }}
              error={fieldErrors.confirmPassword}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
