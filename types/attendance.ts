export type AdminAttendanceRow = {
  id: string
  userId: string
  userDisplayId: string
  fullName: string
  date: string
  status: "present" | "late" | "absent" | "incomplete"
  approvalStatus: "pending" | "approved" | "denied"
  timeIn: string | null
  timeOut: string | null
  remarks: string | null
}
