"use client"

import { useState, useEffect } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { swal } from "@/lib/swal"
import {
  validateFullName,
  validateEmail,
  validateUsername,
  validateContactNo,
  validatePassword,
  validatePosition,
  validateUserForm,
} from "@/lib/user-form-validation"
import { checkUserAvailability } from "@/lib/check-user-availability"
import { useDebounce } from "@/lib/use-debounce"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AddUserModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const AddUserModal = ({ open, onClose, onSuccess }: AddUserModalProps) => {
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [contactNo, setContactNo] = useState("")
  const [position, setPosition] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [availabilityErrors, setAvailabilityErrors] = useState<Record<string, string>>({})
  const [serverErrorField, setServerErrorField] = useState<"email" | "username" | "contactNo" | "password" | null>(null)
  const [serverErrorMessage, setServerErrorMessage] = useState("")

  const debouncedEmail = useDebounce(email, 400)
  const debouncedUsername = useDebounce(username, 400)
  const debouncedContactNo = useDebounce(contactNo, 400)

  const resetForm = () => {
    setFullName("")
    setUsername("")
    setEmail("")
    setContactNo("")
    setPosition("")
    setPassword("")
    setConfirmPassword("")
    setFieldErrors({})
    setAvailabilityErrors({})
    setServerErrorField(null)
    setServerErrorMessage("")
  }

  const getErrorField = (message: string): "email" | "username" | "contactNo" | "password" | null => {
    const lower = message.toLowerCase()
    if (lower.includes("email")) return "email"
    if (lower.includes("username")) return "username"
    if (lower.includes("contact")) return "contactNo"
    if (lower.includes("password")) return "password"
    return null
  }

  const getFieldError = (field: "fullName" | "email" | "username" | "contactNo" | "position" | "password" | "confirmPassword") => {
    if (serverErrorField === field) return serverErrorMessage
    if (availabilityErrors[field]) return availabilityErrors[field]
    return fieldErrors[field] ?? undefined
  }

  const validateField = (
    field: "fullName" | "email" | "username" | "contactNo" | "position" | "password" | "confirmPassword",
    value: string,
    confirmValue?: string
  ) => {
    let err: string | null = null
    if (field === "fullName") err = validateFullName(value)
    else if (field === "email") err = validateEmail(value)
    else if (field === "username") err = validateUsername(value)
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
    const check = async (field: "email" | "username" | "contactNo", value: string) => {
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
      if (field === "username" && trimmed.length < 3) return
      try {
        const { available } = await checkUserAvailability(field, value)
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          if (available) delete next[field]
          else {
            if (field === "email") next[field] = "Email already exists"
            else if (field === "username") next[field] = "Username already exists"
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
    const check = async (field: "email" | "username" | "contactNo", value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
        return
      }
      if (field === "username" && trimmed.length < 3) return
      try {
        const { available } = await checkUserAvailability(field, value)
        setAvailabilityErrors((prev) => {
          const next = { ...prev }
          if (available) delete next[field]
          else {
            if (field === "email") next[field] = "Email already exists"
            else if (field === "username") next[field] = "Username already exists"
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
    check("username", debouncedUsername)
  }, [debouncedUsername])

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
      username,
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
          username,
          email,
          contactNo,
          position,
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
          label="Username"
          placeholder="jane.doe"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setServerErrorField((prev) => (prev === "username" ? null : prev))
            validateField("username", e.target.value)
          }}
          onBlur={(e) => validateField("username", e.target.value)}
          required
          error={getFieldError("username")}
        />
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PasswordInput
            label="Password"
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
            label="Confirm password"
            placeholder="••••••••"
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
      </form>
    </Modal>
  )
}
