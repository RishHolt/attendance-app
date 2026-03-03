import type { ReactNode } from "react"
import { Card } from "@/components/ui"

type PageSectionProps = {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  padding?: "sm" | "md" | "lg"
}

export const PageSection = ({
  title,
  action,
  children,
  className = "",
  padding = "md",
}: PageSectionProps) => {
  return (
    <Card variant="default" padding={padding} className={className}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </Card>
  )
}
