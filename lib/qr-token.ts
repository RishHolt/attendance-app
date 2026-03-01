import { SignJWT, jwtVerify } from "jose"

const PURPOSE = "qr-clock-in"
const DEFAULT_EXPIRY_HOURS = 24

const getSecret = () => {
  const secret =
    process.env.QR_ATTENDANCE_SECRET?.trim() ?? process.env.AUTH_SECRET?.trim()
  if (!secret || secret.length < 32) return null
  return new TextEncoder().encode(secret)
}

export async function createQrToken(expiryHours = DEFAULT_EXPIRY_HOURS): Promise<string | null> {
  const secret = getSecret()
  if (!secret) return null

  const token = await new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiryHours * 3600)
    .setIssuedAt()
    .sign(secret)
  return token
}

export async function verifyQrToken(token: string): Promise<boolean> {
  const secret = getSecret()
  if (!secret) return true

  if (!token?.trim()) return false
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.purpose === PURPOSE
  } catch {
    return false
  }
}
