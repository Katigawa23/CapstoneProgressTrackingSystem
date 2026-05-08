import { revalidateTag } from "next/cache"

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  createBacklogWebLink,
  deleteBacklogWebLink,
  listBacklogWebLinks,
} from "@backend/repositories/backlog-attachment-repository"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const links = await listBacklogWebLinks(id, user.id)

    return NextResponse.json({ links })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"
    
    console.error(
      `[${new Date().toISOString()}] Failed to load web links for backlog item:`,
      { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
    )
    
    return NextResponse.json(
      { 
        error: "Failed to load backlog web links",
        details: errorMessage,
        code: isAuthError ? "UNAUTHORIZED" : "INTERNAL_ERROR"
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const body = (await request.json()) as {
      url?: string
      label?: string
    }
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const label = typeof body.label === "string" ? body.label.trim() : ""

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const link = await createBacklogWebLink(
      {
        backlogItemId: id,
        url,
        label,
      },
      user.id
    )

    if (!link) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ link }, { status: 201 })
  } catch (error) {
    console.error("Failed to save backlog web link", error)
    return NextResponse.json(
      { error: "Failed to save backlog web link" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const url = new URL(request.url)
    const linkId = url.searchParams.get("linkId")?.trim()

    if (!linkId) {
      return NextResponse.json({ error: "linkId is required" }, { status: 400 })
    }

    const deletedLink = await deleteBacklogWebLink(
      id,
      linkId,
      user.id,
      user.role
    )

    if (!deletedLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ link: deletedLink })
  } catch (error) {
    console.error("Failed to delete backlog web link", error)
    return NextResponse.json(
      { error: "Failed to delete backlog web link" },
      { status: 500 }
    )
  }
}
