"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ArrowLeft, Mail } from "lucide-react"
import { Button, Card, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { swal } from "@/lib/swal"
import { isEmail } from "@/lib/user-form-validation"

export const ForgotPasswordPageContent = () => {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !isEmail(trimmed)) {
      swal.error("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        swal.error(data?.error ?? "Something went wrong")
        return
      }

      setSent(true)
    } catch {
      swal.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

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
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                <Mail className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to sign in
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  {isSubmitting ? "Sending…" : "Send reset link"}
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
          )}
        </Card>
      </motion.div>
    </div>
  )
}
