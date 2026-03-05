const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim())
}

export const validateFullName = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return "Full name is required"
  return null
}

export const validateEmail = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return "Email is required"
  if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email address"
  return null
}

export const validatePassword = (value: string): string | null => {
  if (!value) return "Password is required"
  if (value.length < 8) return "Password must be at least 8 characters"
  return null
}

export const validateContactNo = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return "Contact no is required"
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length !== 11) return "Contact no must be exactly 11 digits"
  return null
}

export const validatePosition = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return "Position is required"
  return null
}

export const validateUserForm = (fields: {
  fullName: string
  email: string
  contactNo: string
  position: string
  password?: string
  confirmPassword?: string
}): Record<string, string> => {
  const errors: Record<string, string> = {}
  const fullNameErr = validateFullName(fields.fullName)
  const emailErr = validateEmail(fields.email)
  const contactNoErr = validateContactNo(fields.contactNo)
  const positionErr = validatePosition(fields.position)
  if (fullNameErr) errors.fullName = fullNameErr
  if (emailErr) errors.email = emailErr
  if (contactNoErr) errors.contactNo = contactNoErr
  if (positionErr) errors.position = positionErr
  if (fields.password !== undefined) {
    const passwordErr = validatePassword(fields.password)
    if (passwordErr) errors.password = passwordErr
    else if (fields.confirmPassword !== undefined && fields.password !== fields.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }
  }
  return errors
}
