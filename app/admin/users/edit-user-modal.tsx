"use client"

import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { swal } from "@/lib/swal"
import {
  validateFullName,
  validateEmail,
  validateContactNo,
  validatePassword,
  validatePosition,
  validateUserForm,
} from "@/lib/user-form-validation"
import { checkUserAvailability } from "@/lib/check-user-availability"
import { useDebounce } from "@/lib/use-debounce"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserRow = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
  role: "employee" | "admin" | "ojt"
  requiredHours?: number | null
}

type EditUserModalProps = {
  open: boolean
  user: UserRow | null
  onClose: () => void
  onSuccess?: () => void
}

export const EditUserModal = ({
  open,
  user,
  onClose,
  onSuccess,
}: EditUserModalProps) => {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [contactNo, setContactNo] = useState("")
  const [position, setPosition] = useState("")
  const [role, setRole] = useState<"employee" | "admin" | "ojt">("employee")
  const [requiredHours, setRequiredHours] = useState<string>("")
  const [ojtProgress, setOjtProgress] = useState<{ hoursCompleted: number; percent: number | null } | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [availabilityErrors, setAvailabilityErrors] = useState<Record<string, string>>({})
  const [serverErrorField, setServerErrorField] = useState<"email" | "contactNo" | "password" | null>(null)
  const [serverErrorMessage, setServerErrorMessage] = useState("")

  useEffect(() => {
    if (!user || user.role !== "ojt") { setOjtProgress(null); return }
    fetch("/api/users/ojt-progress")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { userId: string; hoursCompleted: number; percent: number | null }[] | null) => {
        const entry = data?.find((p) => p.userId === user.id)
        if (entry) setOjtProgress({ hoursCompleted: entry.hoursCompleted, percent: entry.percent })
      })
      .catch(() => {})
  }, [user])

  const debouncedEmail = useDebounce(email, 400)
  const debouncedContactNo = useDebounce(contactNo, 400)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName)
      setEmail(user.email)
      setContactNo(user.contactNo ?? "")
      setPosition(user.position ?? "")
      setRole(user.role ?? "employee")
      setRequiredHours(user.requiredHours != null ? String(user.requiredHours) : "")
      setOjtProgress(null)
      setPassword("")
      setConfirmPassword("")
      setFieldErrors({})
      setAvailabilityErrors({})
      setServerErrorField(null)
      setServerErrorMessage("")
    }
  }, [user])

  const getErrorField = (message: string): "email" | "contactNo" | "password" | null => {
    const lower = message.toLowerCase()
    if (lower.includes("email")) return "email"
    if (lower.includes("contact")) return "contactNo"
    if (lower.includes("password")) return "password"
    return null
  }

  const getFieldError = (field: "fullName" | "email" | "contactNo" | "position" | "password" | "confirmPassword") => {
    if (serverErrorField === field) return serverErrorMessage
    if (availabilityErrors[field]) return availabilityErrors[field]
    return fieldErrors[field] ?? undefined
  }

  const validateField = (
    field: "fullName" | "email" | "contactNo" | "position" | "password" | "confirmPassword",
    value: string,
    confirmValue?: string
  ) => {
    let err: string | null = null
    if (field === "fullName") err = validateFullName(value)
    else if (field === "email") err = validateEmail(value)
    else if (field === "contactNo") err = validateContactNo(value)
    else if (field === "position") err = validatePosition(value)
    else if (field === "password") err = value ? validatePassword(value) : null
    else if (field === "confirmPassword")
      err = value !== (confirmValue ?? password) ? "Passwords do not match" : null
    setFieldErrors((prev) => {
      const next = { ...prev }
      if (err) next[field] = err
      else delete next[field]
      return next
    })
  }

  useEffect(() => {
    if (!user) return
    // Skip if debounce hasn't caught up to current email state yet
    if (debouncedEmail.trim() !== email.trim()) return
    if (debouncedEmail.trim() === (user.email ?? "").trim()) {
      setAvailabilityErrors((prev) => {
        const next = { ...prev }
        delete next.email
        return next
      })
      return
    }
    const check = async (field: "email" | "contactNo", value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
        return
      }
      if (field === "email" && !EMAIL_REGEX.test(trimmed)) return
      try {
        const { available } = await checkUserAvailability(field, value, user.id)
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          if (available) delete next[field]
          else {
            if (field === "email") next[field] = "Email already exists"
            else next[field] = "Contact no already exists"
          }
          return next
        })
      } catch {
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      }
    }
    check("email", debouncedEmail)
  }, [debouncedEmail, email, user])

  useEffect(() => {
    if (!user) return
    // Skip if debounce hasn't caught up to current contactNo state yet
    if (debouncedContactNo.trim() !== contactNo.trim()) return
    const originalContact = (user.contactNo ?? "").trim()
    if (debouncedContactNo.trim() === originalContact) {
      setAvailabilityErrors((prev) => {
        const next = { ...prev }
        delete next.contactNo
        return next
      })
      return
    }
    const check = async (field: "contactNo", value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
        return
      }
      const digits = trimmed.replace(/\D/g, "")
      if (digits.length !== 11) return
      try {
        const { available } = await checkUserAvailability(field, value, user.id)
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          if (available) delete next[field]
          else next[field] = "Contact no already exists"
          return next
        })
      } catch {
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      }
    }
    check("contactNo", debouncedContactNo)
  }, [debouncedContactNo, contactNo, user])

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

  const hasChanges =
    !user ||
    fullName !== user.fullName ||
    email !== user.email ||
    contactNo !== (user.contactNo ?? "") ||
    position !== (user.position ?? "") ||
    role !== (user.role ?? "employee") ||
    requiredHours !== (user.requiredHours != null ? String(user.requiredHours) : "") ||
    (password.trim().length > 0 && password === confirmPassword)

  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const validationErrors = validateUserForm({ fullName, email, contactNo, position })
    if (password || confirmPassword) {
      if (!password || !confirmPassword) {
        validationErrors.password = "Enter both password fields to change password"
      } else {
        const passwordErr = validatePassword(password)
        if (passwordErr) validationErrors.password = passwordErr
        else if (password !== confirmPassword)
          validationErrors.confirmPassword = "Passwords do not match"
      }
    }
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }
    if (Object.keys(availabilityErrors).length > 0) return
    setIsSubmitting(true)
    setServerErrorField(null)
    setServerErrorMessage("")
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          contactNo,
          position,
          role,
          requiredHours: role === "ojt" && requiredHours.trim() ? Number(requiredHours) : null,
          ...(password.trim() ? { password: password.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data.error ?? "Failed to update user"
        setServerErrorField(getErrorField(errMsg))
        setServerErrorMessage(errMsg)
        swal.error(errMsg)
        return
      }
      await swal.success("User updated successfully")
      onClose()
      onSuccess?.()
    } catch {
      swal.error("Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit user"
      description="Update user details"
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
            form="edit-user-form"
            className="flex-1"
            disabled={isSubmitting || !hasChanges}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form
        id="edit-user-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Full name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              validateField("fullName", e.target.value)
            }}
            onBlur={(e) => validateField("fullName", e.target.value)}
            required
            error={getFieldError("fullName")}
          />
          <Input
            type="email"
            label="Email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setServerErrorField((prev) => (prev === "email" ? null : prev))
              validateField("email", e.target.value)
            }}
            onBlur={(e) => validateField("email", e.target.value)}
            required
            error={getFieldError("email")}
          />
        </div>
        <Input
          label="Contact no"
          placeholder="e.g. 09171234567"
          type="tel"
          value={contactNo}
          onChange={(e) => {
            setContactNo(e.target.value)
            setServerErrorField((prev) => (prev === "contactNo" ? null : prev))
            validateField("contactNo", e.target.value)
          }}
          onBlur={(e) => validateField("contactNo", e.target.value)}
          error={getFieldError("contactNo")}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Position"
            placeholder="e.g. Developer, Manager"
            value={position}
            onChange={(e) => {
              setPosition(e.target.value)
              validateField("position", e.target.value)
            }}
            onBlur={(e) => validateField("position", e.target.value)}
            required
            error={getFieldError("position")}
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="edit-user-role">
              Role
            </label>
            <select
              id="edit-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "employee" | "admin" | "ojt")}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            >
              <option value="employee">Employee</option>
              <option value="ojt">OJT / Intern</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {role === "ojt" && (
          <div className="flex flex-col gap-3">
            <Input
              label="Required hours"
              placeholder="e.g. 486"
              type="number"
              min={1}
              value={requiredHours}
              onChange={(e) => setRequiredHours(e.target.value)}
              helperText="Total OJT hours target (if required)"
            />
            {ojtProgress && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Required Time Progress
                </p>
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  <span className="font-semibold tabular-nums">{ojtProgress.hoursCompleted}</span>
                  {requiredHours.trim() ? (
                    <> / <span className="tabular-nums">{requiredHours}</span> hrs</>
                  ) : " hrs completed"}
                  {ojtProgress.percent != null && (
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">({ojtProgress.percent}%)</span>
                  )}
                </p>
                {ojtProgress.percent != null && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="relative h-2 overflow-hidden rounded-full bg-violet-500 transition-all"
                      style={{ width: `${ojtProgress.percent}%` }}
                    >
                      <div className="animate-shimmer absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
              id="edit-user-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setServerErrorField((prev) => (prev === "password" ? null : prev))
                validateField("password", e.target.value)
                if (confirmPassword) validateField("confirmPassword", confirmPassword, e.target.value)
              }}
              onBlur={(e) => validateField("password", e.target.value)}
              minLength={8}
              helperText="Leave blank to keep current password"
              error={getFieldError("password")}
            />
            <PasswordInput
              id="edit-user-confirm-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                validateField("confirmPassword", e.target.value, password)
              }}
              onBlur={(e) => validateField("confirmPassword", e.target.value, password)}
              minLength={8}
              error={getFieldError("confirmPassword")}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
