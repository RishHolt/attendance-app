import type { ComponentPropsWithoutRef } from "react"

const cardBaseStyles =
  "rounded-2xl transition-all duration-200"

const cardVariants = {
  default:
    "border border-zinc-200/80 bg-white shadow-lg shadow-zinc-200/30 dark:border-zinc-700/50 dark:bg-zinc-900/90 dark:shadow-zinc-950/50",
  glass:
    "border border-zinc-200/80 bg-white/80 shadow-xl shadow-zinc-200/40 backdrop-blur-xl dark:border-zinc-700/50 dark:bg-zinc-900/80 dark:shadow-zinc-950/50",
  elevated:
    "border-0 bg-white shadow-2xl shadow-zinc-300/50 dark:bg-zinc-900 dark:shadow-zinc-950/80",
  outline:
    "border-2 border-zinc-200 bg-transparent dark:border-zinc-700",
}

const cardPadding = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
}

type CardProps = ComponentPropsWithoutRef<"div"> & {
  variant?: keyof typeof cardVariants
  padding?: keyof typeof cardPadding
}

export const Card = ({
  variant = "default",
  padding = "md",
  className = "",
  ...props
}: CardProps) => {
  return (
    <div
      className={`${cardBaseStyles} ${cardVariants[variant]} ${cardPadding[padding]} ${className}`.trim()}
      {...props}
    />
  )
}

export const CardHeader = ({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) => (
  <div className={`mb-6 text-center ${className}`.trim()} {...props} />
)

export const CardTitle = ({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"h1">) => (
  <h1
    className={`text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 ${className}`.trim()}
    {...props}
  />
)

export const CardDescription = ({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"p">) => (
  <p
    className={`mt-2 text-sm text-zinc-500 dark:text-zinc-400 ${className}`.trim()}
    {...props}
  />
)
