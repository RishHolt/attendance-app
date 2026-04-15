import type { Metadata } from "next"
import { ResetPasswordPageContent } from "./reset-password-page-content"

export const metadata: Metadata = {
  title: "Reset password | Attendance",
  description: "Set a new password for your attendance account",
}

export default function ResetPasswordPage() {
  return <ResetPasswordPageContent />
}
