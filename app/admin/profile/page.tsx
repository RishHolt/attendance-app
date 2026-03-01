import { PageHeader } from "@/components/admin/page-header"
import { Card } from "@/components/ui/card"

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <Card variant="default" padding="lg">
        <PageHeader
          title="Profile"
          description="Manage your profile here."
        />
      </Card>
    </div>
  )
}
