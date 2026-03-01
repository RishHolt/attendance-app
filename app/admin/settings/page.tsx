import { PageHeader } from "@/components/admin/page-header"
import { Card } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card variant="default" padding="lg">
        <PageHeader
          title="Settings"
          description="Configure application settings here."
        />
      </Card>
    </div>
  )
}
