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
import { StarsBackground } from "@/components/animate-ui/components/backgrounds/stars"
import { useTheme } from "@/components/theme-provider"
import { LoginForm } from "./login-form"

export const LoginPageContent = () => {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-16">
      <StarsBackground
        starColor={isDark ? "#FFF" : "#000"}
        pointerEvents={false}
        className={
          isDark
            ? "absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]"
            : "absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]"
        }
      />

      <div className="absolute right-4 top-4 z-20">
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
