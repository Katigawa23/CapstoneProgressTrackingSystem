import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  isGoogleDriveUploadConfigured,
  uploadAttachmentToGoogleDrive,
} from "@/lib/google-drive"
import {
  createBacklogSubmission,
  deleteBacklogSubmission,
  listBacklogSubmissions,
} from "@backend/repositories/backlog-attachment-repository"

export const runtime = "nodejs"

function sanitizeFileName(fileName: string) {
  const trimmedName = fileName.trim()

  if (!trimmedName) {
    return "submission"
  }

  return trimmedName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const submissions = await listBacklogSubmissions(id, user.id)

    return NextResponse.json({ submissions })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"
    
    console.error(
      `[${new Date().toISOString()}] Failed to load submissions for backlog item:`,
      { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }
    )
    
    return NextResponse.json(
      { 
        error: "Failed to load backlog submissions",
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
    const formData = await request.formData()
    const files = formData.getAll("files").filter((value): value is File => value instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one file is required" }, { status: 400 })
    }

    const submissions = await Promise.all(
      files.map(async (file) => {
        const submissionId = randomUUID()
        const safeName = sanitizeFileName(file.name) || "submission"
        const bytes = Buffer.from(await file.arrayBuffer())
        const driveUpload = isGoogleDriveUploadConfigured()
          ? await uploadAttachmentToGoogleDrive({
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              fileData: bytes,
            }).catch((error) => {
              console.warn("Google Drive upload failed; using local attachment storage.", error)
              return null
            })
          : null

        return createBacklogSubmission({
          id: submissionId,
          backlogItemId: id,
          fileName: file.name,
          fileUrl: `/api/backlog-items/${id}/submissions/file?submissionId=${encodeURIComponent(submissionId)}&filename=${encodeURIComponent(safeName)}`,
          driveFileId: driveUpload?.id ?? null,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileData: bytes,
        }, user.id)
      })
    )

    if (submissions.some((submission) => submission === null)) {
      return NextResponse.json(
        { error: "Backlog item not found" },
        { status: 404 }
      )
    }

    const createdSubmissions = submissions.filter(
      (submission): submission is NonNullable<(typeof submissions)[number]> =>
        submission !== null
    )

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ submissions: createdSubmissions }, { status: 201 })
  } catch (error) {
    console.error("Failed to upload backlog submissions", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to upload backlog submissions",
        details: errorMessage,
      },
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
    const submissionId = url.searchParams.get("submissionId")?.trim()

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 }
      )
    }

    const deletedSubmission = await deleteBacklogSubmission(
      id,
      submissionId,
      user.id,
      user.role
    )

    if (!deletedSubmission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    revalidateTag("backlog-items", "max")

    return NextResponse.json({ submission: deletedSubmission })
  } catch (error) {
    console.error("Failed to delete backlog submission", error)
    return NextResponse.json(
      { error: "Failed to delete backlog submission" },
      { status: 500 }
    )
  }
}
