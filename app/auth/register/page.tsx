import type { Metadata } from "next"
import { RegisterPageContent } from "./register-page-content"

export const metadata: Metadata = {
  title: "Register | Attendance",
  description: "Create your attendance account",
}

export default function RegisterPage() {
  return <RegisterPageContent />
}
