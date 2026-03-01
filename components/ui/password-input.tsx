"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "./input"

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "rightAddon"
>

export const PasswordInput = (props: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false)

  const handleToggleClick = () => {
    setShowPassword((prev) => !prev)
  }

  const rightAddon = (
    <button
      type="button"
      onClick={handleToggleClick}
      aria-label={showPassword ? "Hide password" : "Show password"}
      tabIndex={-1}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" aria-hidden />
      ) : (
        <Eye className="h-4 w-4" aria-hidden />
      )}
    </button>
  )

  return (
    <Input
      type={showPassword ? "text" : "password"}
      rightAddon={rightAddon}
      {...props}
    />
  )
}
