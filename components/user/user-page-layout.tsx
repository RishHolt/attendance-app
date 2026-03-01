import type { ReactNode } from "react"
import { PageHeader } from "./page-header"
import { UserProfileCard } from "./user-profile-card"

type UserPageLayoutProps = {
  title: string
  description?: string
  actions?: ReactNode
  showUserDetails?: boolean
  children: ReactNode
}

export const UserPageLayout = ({
  title,
  description,
  actions,
  showUserDetails = true,
  children,
}: UserPageLayoutProps) => {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      {showUserDetails && <UserProfileCard />}
      {children}
    </div>
  )
}
