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

type UserRow = {
  id: string
  userId: string
  fullName: string
  username: string | null
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
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

  useEffect(() => {
    if (user) {
      setFullName(user.fullName)
      setUsername(user.username ?? "")
      setEmail(user.email)
      setContactNo(user.contactNo ?? "")
      setPosition(user.position ?? "")
      setPassword("")
      setConfirmPassword("")
      setFieldErrors({})
      setAvailabilityErrors({})
      setServerErrorField(null)
      setServerErrorMessage("")
    }
  }, [user])

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
        const { available } = await checkUserAvailability(field, value, user.id)
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
  }, [debouncedEmail, user])

  useEffect(() => {
    if (!user) return
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
        const { available } = await checkUserAvailability(field, value, user.id)
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
  }, [debouncedUsername, user])

  useEffect(() => {
    if (!user) return
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
  }, [debouncedContactNo, user])

  const hasChanges =
    !user ||
    fullName !== user.fullName ||
    username !== (user.username ?? "") ||
    email !== user.email ||
    contactNo !== (user.contactNo ?? "") ||
    position !== (user.position ?? "") ||
    (password.trim().length > 0 && password === confirmPassword)

  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const validationErrors = validateUserForm({ fullName, email, username, contactNo, position })
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
          username,
          email,
          contactNo,
          position,
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            error={getFieldError("username")}
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
            label="Confirm password"
            placeholder="••••••••"
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
      </form>
    </Modal>
  )
}
