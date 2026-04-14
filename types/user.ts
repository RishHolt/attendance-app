export type UserRow = {
  id: string
  userId: string
  fullName: string
  email: string
  contactNo: string | null
  position: string | null
  status: "active" | "inactive"
  startDate: string | null
  role: "employee" | "admin" | "ojt"
}
