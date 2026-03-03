import type { ReactNode } from "react"
import { PageHeader } from "./page-header"

type UserPageLayoutProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export const UserPageLayout = ({
  title,
  description,
  actions,
  children,
}: UserPageLayoutProps) => {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  )
}
