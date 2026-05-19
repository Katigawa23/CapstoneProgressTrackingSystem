import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { archiveBacklogSubmission } from "@backend/repositories/attachments-repository"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const url = new URL(request.url)
    const submissionId = url.searchParams.get("submissionId")?.trim()

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 })
    }

    const submission = await archiveBacklogSubmission(id, submissionId, user.id, user.role)

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    revalidateTag("backlog-items", "max")
    return NextResponse.json({ submission })
  } catch (error) {
    console.error("Failed to archive backlog submission", error)
    return NextResponse.json(
      { error: "Failed to archive backlog submission" },
      { status: 500 }
    )
  }
}
