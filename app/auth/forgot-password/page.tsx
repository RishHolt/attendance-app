import type { Metadata } from "next"
import { ForgotPasswordPageContent } from "./forgot-password-page-content"

export const metadata: Metadata = {
  title: "Forgot password | Attendance",
  description: "Reset your attendance account password",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />
}
