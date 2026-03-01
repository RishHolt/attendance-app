"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import { Button, Input, PasswordInput } from "@/components/ui"
import { swal } from "@/lib/swal"

const UserPlusIcon = () => (
  <svg
    className="h-4 w-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
    />
  </svg>
)

export const RegisterForm = () => {
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) {
      swal.error(error)
    }
  }, [searchParams])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    const pwd = (form.elements.namedItem("password") as HTMLInputElement)?.value
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement)?.value
    const contact = (form.elements.namedItem("contactNo") as HTMLInputElement)?.value?.trim()
    if (pwd !== confirm) {
      e.preventDefault()
      swal.error("Passwords do not match")
      return
    }
    if (!contact) {
      e.preventDefault()
      swal.error("Contact no is required")
      return
    }
    const digits = contact.replace(/\D/g, "")
    if (digits.length !== 11) {
      e.preventDefault()
      swal.error("Contact no must be exactly 11 digits")
      return
    }
    setIsSubmitting(true)
  }

  return (
    <form
      action="/api/auth/register"
      method="POST"
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      noValidate
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Input
            id="fullName"
            name="fullName"
            type="text"
            label="Full name"
            placeholder="John Doe"
            autoComplete="name"
            required
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.19, duration: 0.4 }}
        >
          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.31, duration: 0.4 }}
      >
        <Input
          id="username"
          name="username"
          type="text"
          label="Username"
          placeholder="johndoe"
          autoComplete="username"
          minLength={3}
          required
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <Input
          id="contactNo"
          name="contactNo"
          type="tel"
          label="Contact no"
          placeholder="e.g. 09171234567"
          autoComplete="tel"
          required
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.39, duration: 0.4 }}
      >
        <Input
          id="position"
          name="position"
          type="text"
          label="Position"
          placeholder="e.g. Developer, Manager"
          required
        />
      </motion.div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.43, duration: 0.4 }}
        >
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            helperText="Minimum 8 characters"
            required
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.47, duration: 0.4 }}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.51, duration: 0.4 }}
      >
        <Button
          type="submit"
          isLoading={isSubmitting}
          leftIcon={<UserPlusIcon />}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.51, duration: 0.4 }}
        className="text-center text-sm text-zinc-600 dark:text-zinc-400"
      >
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          Sign in
        </Link>
      </motion.p>
    </form>
  )
}
