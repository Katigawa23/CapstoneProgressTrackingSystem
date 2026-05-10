import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { restoreDeletedBacklogAttachment } from "@backend/repositories/backlog-attachment-repository"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const attachment = await restoreDeletedBacklogAttachment(id, user.id, user.role)

    if (!attachment) {
      return NextResponse.json(
        { error: "Deleted resource not found or cannot be restored" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ attachment })
  } catch (error) {
    console.error("Failed to restore deleted resource", error)
    return NextResponse.json(
      { error: "Failed to restore deleted resource" },
      { status: 500 }
    )
  }
}
