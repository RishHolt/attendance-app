"use client"

import { forwardRef } from "react"
import type { ComponentPropsWithoutRef } from "react"
import { Label } from "./label"

const inputBaseStyles =
  "min-h-[44px] w-full rounded-xl border bg-white px-4 py-2.5 text-base text-zinc-900 placeholder-zinc-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:select-none dark:bg-zinc-900/50 dark:text-zinc-100 dark:placeholder-zinc-500"

const inputVariants = {
  default:
    "border-zinc-200 hover:border-zinc-300 focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:hover:border-zinc-600 dark:focus:border-zinc-500 dark:focus:ring-zinc-800",
  error:
    "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-950/50",
}

type InputProps = ComponentPropsWithoutRef<"input"> & {
  label?: string
  error?: string
  errorId?: string
  helperText?: string
  rightAddon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      errorId,
      helperText,
      rightAddon,
      className = "",
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedby,
      ...props
    },
    ref
  ) => {
    const hasError = !!error || ariaInvalid === true
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, "-")
    const describedBy = [ariaDescribedby, hasError && errorId].filter(Boolean).join(" ") || undefined

    const inputElement = rightAddon ? (
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          className={`${inputBaseStyles} ${hasError ? inputVariants.error : inputVariants.default} pr-12 ${className}`.trim()}
          {...props}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightAddon}</div>
      </div>
    ) : (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={`${inputBaseStyles} ${hasError ? inputVariants.error : inputVariants.default} ${className}`.trim()}
        {...props}
      />
    )

    if (label || helperText || error) {
      return (
        <div className="flex flex-col gap-2">
          {label && <Label htmlFor={inputId}>{label}</Label>}
          {inputElement}
          {hasError && error && (
            <p className="text-xs text-red-600 dark:text-red-400" id={errorId} role="alert">
              {error}
            </p>
          )}
          {helperText && !hasError && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
          )}
        </div>
      )
    }

    return inputElement
  }
)

Input.displayName = "Input"
