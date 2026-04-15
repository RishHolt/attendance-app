"use client"

import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { swal } from "@/lib/swal"
import {
  isEmail,
  validateFullName,
  validateEmail,
  validateContactNo,
  validatePassword,
  validatePosition,
  validateUserForm,
} from "@/lib/user-form-validation"
import { checkUserAvailability } from "@/lib/check-user-availability"
import { useDebounce } from "@/lib/use-debounce"

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
  const [availabilityErrors, setAvailabilityErrors] = useState<Record<string, string>>({})
  const [serverErrorField, setServerErrorField] = useState<"email" | "contactNo" | "password" | null>(null)
  const [serverErrorMessage, setServerErrorMessage] = useState("")

  const debouncedEmail = useDebounce(email, 400)
  const debouncedContactNo = useDebounce(contactNo, 400)

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
    setAvailabilityErrors({})
    setServerErrorField(null)
    setServerErrorMessage("")
  }

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
    else if (field === "password") err = validatePassword(value)
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
      if (field === "email" && !isEmail(trimmed)) return
      try {
        const { available } = await checkUserAvailability(field, value)
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
  }, [debouncedEmail])

  useEffect(() => {
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
        const { available } = await checkUserAvailability(field, value)
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
  }, [debouncedContactNo])

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
    if (Object.keys(availabilityErrors).length > 0) return
    setIsSubmitting(true)
    setServerErrorField(null)
    setServerErrorMessage("")
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
        setServerErrorField(getErrorField(errMsg))
        setServerErrorMessage(errMsg)
        swal.error(errMsg)
        return
      }
      await swal.success("User created successfully")
      resetForm()
      onClose()
      onSuccess?.()
    } catch {
      setServerErrorField(null)
      setServerErrorMessage("")
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
          required
          error={getFieldError("contactNo")}
        />
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
              onChange={(e) => {
                setPassword(e.target.value)
                validateField("password", e.target.value)
                if (confirmPassword) validateField("confirmPassword", confirmPassword, e.target.value)
              }}
              onBlur={(e) => validateField("password", e.target.value)}
              required
              minLength={8}
              helperText="Minimum 8 characters"
              error={getFieldError("password")}
            />
            <PasswordInput
              id="add-user-confirm-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                validateField("confirmPassword", e.target.value, password)
              }}
              onBlur={(e) => validateField("confirmPassword", e.target.value, password)}
              required
              minLength={8}
              error={getFieldError("confirmPassword")}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
