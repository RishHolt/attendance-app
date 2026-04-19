import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id, avatar_url")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("avatar") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 5 MB" }, { status: 400 })
    }

    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg"
    const path = `${userRow.id}.${ext}`

    const admin = createAdminClient()
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path)
    const avatarUrl = `${publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", userRow.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ avatarUrl })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload avatar" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email.toLowerCase())
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const admin = createAdminClient()
    const extensions = ["jpg", "png", "webp"]
    await Promise.allSettled(
      extensions.map((ext) => admin.storage.from("avatars").remove([`${userRow.id}.${ext}`]))
    )

    await supabase.from("users").update({ avatar_url: null }).eq("id", userRow.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove avatar" },
      { status: 500 }
    )
  }
}
