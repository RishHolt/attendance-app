import { NextResponse } from "next/server"
import { verifyQrToken } from "@/lib/qr-token"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const valid = await verifyQrToken(token ?? "")
    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
