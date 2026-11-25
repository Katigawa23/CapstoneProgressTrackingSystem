import { canAccessProject } from "@/lib/server-project-access"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { isSuperAdminViewer } from "@/lib/server-admin-viewer"
import { getDb } from "@/lib/server-db"
import { listBacklogItems } from "@backend/repositories/tasks-repository"
import { listArchivedBacklogAttachments } from "@backend/repositories/attachments-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")?.trim()

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!(await canAccessProject(projectId, user.id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const [items, attachments] = await Promise.all([
      listBacklogItems(projectId, user.id, { archived: true, limit: 500, offset: 0 }),
      listArchivedBacklogAttachments(projectId, user.id),
    ])

    const userIds = [...new Set([
      ...items.flatMap((item) => [item.createdByUserId, item.archivedByUserId]),
      ...attachments.flatMap((item) => [item.uploadedByUserId, item.archivedByUserId]),
    ].filter(Boolean))]
    const namesById = userIds.length && process.env.DATABASE_URL
      ? Object.fromEntries((await getDb().query<{ user_id: string; name: string }>(
          `select distinct on (microsoft_user_id) microsoft_user_id as user_id, name
           from users
           where microsoft_user_id = any($1::text[]) and btrim(name) <> ''
           order by microsoft_user_id, login_at desc, id desc`,
          [userIds]
        )).rows.map(({ user_id, name }) => [user_id, name.trim()]))
      : {}

    return NextResponse.json({
      items,
      attachments,
      namesById,
      attachmentsRestricted: isSuperAdminViewer(user.id),
    })
  } catch (error) {
    console.error("Failed to load archive items", error)
    return NextResponse.json(
      { error: "Failed to load archive items" },
      { status: 500 }
    )
  }
}
