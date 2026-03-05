import { describe, it, expect } from "vitest"
import {
  isEmail,
  validateFullName,
  validateEmail,
  validatePassword,
  validateContactNo,
  validatePosition,
  validateUserForm,
} from "../user-form-validation"

describe("isEmail", () => {
  it("returns true for valid emails", () => {
    expect(isEmail("a@b.co")).toBe(true)
    expect(isEmail("user@example.com")).toBe(true)
    expect(isEmail("  user@example.com  ")).toBe(true)
  })

  it("returns false for invalid emails", () => {
    expect(isEmail("")).toBe(false)
    expect(isEmail("no-at")).toBe(false)
    expect(isEmail("@nodomain.com")).toBe(false)
    expect(isEmail("nodomain@")).toBe(false)
  })
})

describe("validateFullName", () => {
  it("returns error when empty", () => {
    expect(validateFullName("")).toBe("Full name is required")
    expect(validateFullName("   ")).toBe("Full name is required")
  })

  it("returns null when valid", () => {
    expect(validateFullName("John Doe")).toBe(null)
  })
})

describe("validateEmail", () => {
  it("returns error when empty or invalid", () => {
    expect(validateEmail("")).toBe("Email is required")
    expect(validateEmail("bad")).toBe("Please enter a valid email address")
  })

  it("returns null when valid", () => {
    expect(validateEmail("user@example.com")).toBe(null)
  })
})

describe("validatePassword", () => {
  it("returns error when empty or too short", () => {
    expect(validatePassword("")).toBe("Password is required")
    expect(validatePassword("short")).toBe("Password must be at least 8 characters")
  })

  it("returns null when 8+ chars", () => {
    expect(validatePassword("password")).toBe(null)
  })
})

describe("validateContactNo", () => {
  it("returns error when empty or not 11 digits", () => {
    expect(validateContactNo("")).toBe("Contact no is required")
    expect(validateContactNo("123")).toBe("Contact no must be exactly 11 digits")
    expect(validateContactNo("0917123456")).toBe("Contact no must be exactly 11 digits")
  })

  it("accepts 11 digits with non-digits stripped", () => {
    expect(validateContactNo("09171234567")).toBe(null)
    expect(validateContactNo("0917-123-4567")).toBe(null)
  })
})

describe("validatePosition", () => {
  it("returns error when empty", () => {
    expect(validatePosition("")).toBe("Position is required")
  })

  it("returns null when valid", () => {
    expect(validatePosition("Developer")).toBe(null)
  })
})

describe("validateUserForm", () => {
  it("returns errors for invalid fields", () => {
    const result = validateUserForm({
      fullName: "",
      email: "bad",
      contactNo: "1",
      position: "",
    })
    expect(result.fullName).toBeDefined()
    expect(result.email).toBeDefined()
    expect(result.contactNo).toBeDefined()
    expect(result.position).toBeDefined()
  })

  it("returns empty object when all valid", () => {
    const result = validateUserForm({
      fullName: "Jane Doe",
      email: "jane@example.com",
      contactNo: "09171234567",
      position: "Engineer",
    })
    expect(Object.keys(result)).toHaveLength(0)
  })

  it("validates password and confirmPassword when provided", () => {
    const result = validateUserForm({
      fullName: "Jane",
      email: "j@x.com",
      contactNo: "09171234567",
      position: "Eng",
      password: "short",
      confirmPassword: "short",
    })
    expect(result.password).toBe("Password must be at least 8 characters")

    const mismatch = validateUserForm({
      fullName: "Jane",
      email: "j@x.com",
      contactNo: "09171234567",
      position: "Eng",
      password: "password123",
      confirmPassword: "password456",
    })
    expect(mismatch.confirmPassword).toBe("Passwords do not match")
  })
})
