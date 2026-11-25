import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { deleteNotifications, listNotifications, markNotificationRead } from "@/lib/server-notification-repository"

export async function GET() {
  try {
    const user = await requireAuthenticatedUser()
    const notifications = await listNotifications(user.id)
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Failed to load notifications", error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const body = await request.json().catch(() => ({})) as { id?: string }
    await markNotificationRead(user.id, body.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update notifications", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}


export async function DELETE(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const body = await request.json().catch(() => null)
    const ids = body?.ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 ||
        !ids.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) {
      return NextResponse.json({ error: "Select valid notifications." }, { status: 400 })
    }
    await deleteNotifications(user.id, ids)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete notifications", error)
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
