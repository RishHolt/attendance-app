"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
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
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("login", login.trim())
      formData.set("password", password)
      const returnTo = searchParams.get("returnTo") ?? ""
      if (returnTo) formData.set("returnTo", returnTo)

      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        swal.error(data?.error ?? "Sign in failed")
        setIsSubmitting(false)
        return
      }

      if (data?.redirect) {
        window.location.href = data.redirect
      } else {
        window.location.href = "/admin"
      }
    } catch {
      swal.error("Something went wrong")
      setIsSubmitting(false)
    }
  }

  const returnTo = searchParams.get("returnTo") ?? ""

  return (
    <form
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
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
    </form>
  )
}
