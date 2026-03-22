"use client"

import { Suspense } from "react"
import { motion } from "motion/react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand-logo"
import { LoginForm } from "./login-form"

export const LoginPageContent = () => {
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
            <CardTitle>SDO Attendance</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50" />}>
            <LoginForm />
          </Suspense>
        </Card>
      </motion.div>
    </div>
  )
}
