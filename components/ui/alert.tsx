import type { ComponentPropsWithoutRef } from "react"

const alertBaseStyles =
  "rounded-xl border px-4 py-3 text-sm transition-colors duration-200"

const alertVariants = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
}

type AlertProps = ComponentPropsWithoutRef<"div"> & {
  variant?: keyof typeof alertVariants
}

export const Alert = ({
  variant = "error",
  role = "alert",
  className = "",
  ...props
}: AlertProps) => {
  return (
    <div
      role={role}
      className={`${alertBaseStyles} ${alertVariants[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
