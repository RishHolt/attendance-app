"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui"
import { PasswordInput } from "@/components/ui/password-input"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { swal } from "@/lib/swal"

const ResetPasswordForm = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      router.replace("/auth/forgot-password")
    }
  }, [token, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    if (password.length < 8) {
      swal.error("Password must be at least 8 characters")
      return
    }

    if (password !== confirmPassword) {
      swal.error("Passwords do not match")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        swal.error(data?.error ?? "Something went wrong")
        return
      }

      window.location.href = "/auth/login?message=Password+updated+successfully"
    } catch {
      swal.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="flex flex-col gap-4"
      >
        <PasswordInput
          id="password"
          name="password"
          label="New password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.23, duration: 0.4 }}
        className="flex flex-col gap-3"
      >
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>

        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to sign in
        </Link>
      </motion.div>
    </form>
  )
}

export const ResetPasswordPageContent = () => {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-16">
      <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-950" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-50 dark:bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] dark:opacity-40" />
      <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-zinc-200/70 blur-3xl dark:bg-zinc-800/50" />
      <div className="absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-zinc-200/70 blur-3xl dark:bg-zinc-800/50" />

      <div className="absolute right-4 top-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <ThemeToggle />
        </motion.div>
      </div>

      <motion.div
        className="relative z-10 w-full max-w-full min-w-0 sm:max-w-[420px]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card variant="glass" padding="lg" className="w-full p-6 sm:p-8">
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <BrandLogo size={72} />
            </div>
            <CardTitle>Set new password</CardTitle>
            <CardDescription>Choose a strong password for your account.</CardDescription>
          </CardHeader>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50" />}>
            <ResetPasswordForm />
          </Suspense>
        </Card>
      </motion.div>
    </div>
  )
}
