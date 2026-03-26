import { NextResponse, type NextRequest } from "next/server"

type RateLimitEntry = {
  timestamps: number[]
}

type RateLimitConfig = {
  maxRequests: number
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
}

const AUTH_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60_000,
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 5 * 60_000
let lastCleanup = Date.now()

const cleanup = () => {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

const getClientIdentifier = (request: NextRequest): string => {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"
  return ip
}

const getConfigForPath = (pathname: string): RateLimitConfig => {
  if (pathname.startsWith("/api/auth/")) return AUTH_CONFIG
  return DEFAULT_CONFIG
}

export const checkRateLimit = (request: NextRequest): NextResponse | null => {
  const ip = getClientIdentifier(request)
  const pathname = request.nextUrl.pathname
  const config = getConfigForPath(pathname)
  const key = `${ip}:${pathname}`
  const now = Date.now()

  cleanup()

  const entry = store.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)

    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((now + retryAfterMs) / 1000)),
        },
      }
    )
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return null
}
