import { revalidateTag } from "next/cache"

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { notifyProjectAdvisers } from "@/lib/server-notification-repository"
import { getDb } from "@/lib/server-db"
import { rejectCompletedTaskMutation } from "@/lib/server-completed-task"
import {
  isSuperAdminViewer,
  rejectSuperAdminMutation,
} from "@/lib/server-admin-viewer"
import {
  createBacklogWebLink,
  listBacklogWebLinks,
} from "@backend/repositories/attachments-repository"

export const runtime = "nodejs"

function toActiveWebLinkResponse(
  link: Awaited<ReturnType<typeof listBacklogWebLinks>>[number]
) {
  return {
    id: link.id,
    backlogItemId: link.backlogItemId,
    uploadedByUserId: link.uploadedByUserId,
    url: link.url,
    label: link.label,
    uploadedAt: link.uploadedAt,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()

    if (isSuperAdminViewer(user.id)) {
      return NextResponse.json({ links: [], restricted: true })
    }

    const { id } = await params
    const links = await listBacklogWebLinks(id, user.id)

    return NextResponse.json({ links: links.map(toActiveWebLinkResponse) })
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
    const readOnlyResponse = rejectSuperAdminMutation(user.id)
    if (readOnlyResponse) return readOnlyResponse
    const completionResponse = await rejectCompletedTaskMutation((await params).id)
    if (completionResponse) return completionResponse
    if (user.role !== "student") {
      return NextResponse.json(
        { error: "Only students can add task links." },
        { status: 403 }
      )
    }
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

    try {
      const task = await getDb().query<{ project_id: string; title: string }>(
        "select project_id, title from backlog where id = $1", [id]
      )
      if (task.rows[0]) {
        await notifyProjectAdvisers({
          projectId: task.rows[0].project_id, actorUserId: user.id, actorName: user.name,
          backlogItemId: id, taskTitle: task.rows[0].title,
          notificationType: "student_link_submitted", notificationTitle: "New task link submitted",
          notificationMessage: `${user.name} submitted a link for “${task.rows[0].title}”.`,
          dedupeKey: `student-link:${link.id}`,
        })
      }
    } catch { console.error("Link saved, but the submission notification could not be created.") }
    revalidateTag("backlog-items", "max")

    return NextResponse.json(
      { link: toActiveWebLinkResponse(link) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to save backlog web link", error)
    return NextResponse.json(
      { error: "Failed to save backlog web link" },
      { status: 500 }
    )
  }
}
