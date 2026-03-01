"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import { Button, Input } from "@/components/ui"
import { swal } from "@/lib/swal"

const LogInIcon = () => (
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
      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
    />
  </svg>
)

export const LoginForm = () => {
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const error = searchParams.get("error")
    const message = searchParams.get("message")
    if (error) {
      swal.error(error)
    }
    if (message) {
      swal.success(message)
    }
  }, [searchParams])

  const handleSubmit = () => {
    setIsSubmitting(true)
  }

  const returnTo = searchParams.get("returnTo") ?? ""

  return (
    <form
      action="/api/auth/login"
      method="POST"
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      noValidate
    >
      {returnTo && (
        <input type="hidden" name="returnTo" value={returnTo} />
      )}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <Input
          id="login"
          name="login"
          type="text"
          label="Email or username"
          placeholder="you@example.com or username"
          autoComplete="username email"
          required
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.23, duration: 0.4 }}
      >
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.31, duration: 0.4 }}
      >
        <Button
          type="submit"
          isLoading={isSubmitting}
          leftIcon={<LogInIcon />}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-center text-sm text-zinc-600 dark:text-zinc-400"
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          Register
        </Link>
      </motion.p>
    </form>
  )
}
