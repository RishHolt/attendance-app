"use client"

import type { ComponentPropsWithoutRef, ReactNode } from "react"

const buttonBaseStyles =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"

const buttonVariants = {
  default:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:ring-blue-400 focus:ring-offset-white dark:bg-blue-600 dark:text-white dark:shadow-blue-950/30 dark:hover:bg-blue-500 dark:focus:ring-blue-500 dark:focus:ring-offset-zinc-950",
  secondary:
    "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:focus:ring-zinc-500 dark:focus:ring-offset-zinc-950",
  ghost:
    "text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:ring-zinc-500 dark:focus:ring-offset-zinc-950",
  destructive:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-red-400 dark:bg-red-700 dark:hover:bg-red-600 dark:focus:ring-red-500",
}

const buttonSizes = {
  default: "min-h-[44px] px-4 py-2.5 text-sm",
  sm: "min-h-[36px] px-3 py-1.5 text-sm",
  lg: "min-h-[48px] px-6 py-3 text-base",
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = ({
  children,
  variant = "default",
  size = "default",
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  "aria-busy": ariaBusy,
  "aria-disabled": ariaDisabled,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled ?? isLoading

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading ?? ariaBusy}
      aria-disabled={isDisabled ?? ariaDisabled}
      className={`${buttonBaseStyles} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        leftIcon
      )}
      {children && <span>{children}</span>}
      {!isLoading && rightIcon}
    </button>
  )
}
