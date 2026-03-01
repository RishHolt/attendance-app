import type { ComponentPropsWithoutRef } from "react"

const labelBaseStyles =
  "text-sm font-medium text-zinc-700 transition-colors duration-200 dark:text-zinc-300"

type LabelProps = ComponentPropsWithoutRef<"label"> & {
  required?: boolean
}

export const Label = ({
  className = "",
  required,
  children,
  ...props
}: LabelProps) => {
  return (
    <label className={`${labelBaseStyles} ${className}`.trim()} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-red-500 dark:text-red-400" aria-hidden>
          *
        </span>
      )}
    </label>
  )
}
