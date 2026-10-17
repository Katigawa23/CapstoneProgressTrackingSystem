import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { listNotifications, markNotificationRead } from "@/lib/server-notification-repository"

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

