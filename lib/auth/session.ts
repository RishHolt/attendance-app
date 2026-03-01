import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const COOKIE_NAME = "auth_session"
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const getSecret = () => {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 chars in .env.local")
  }
  return new TextEncoder().encode(secret)
}

export type SessionPayload = {
  userId: string
  email: string
  fullName: string
  exp: number
}

export const createSession = async (
  payload: Omit<SessionPayload, "exp">,
  maxAge = DEFAULT_MAX_AGE
): Promise<string> => {
  const secret = getSecret()
  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    fullName: payload.fullName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .setIssuedAt()
    .sign(secret)
  return token
}

export const setSessionCookie = async (token: string, maxAge = DEFAULT_MAX_AGE) => {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  })
}

export const getSessionToken = async (): Promise<string | undefined> => {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export const verifySession = async (): Promise<SessionPayload | null> => {
  const token = await getSessionToken()
  if (!token) return null
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      exp: (payload.exp as number) ?? 0,
    }
  } catch {
    return null
  }
}

export const clearSession = async () => {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
