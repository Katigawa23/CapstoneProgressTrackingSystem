import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  createBacklogSubmission,
  listBacklogSubmissions,
} from "@backend/repositories/attachments-repository"

export const runtime = "nodejs"

const DOCUMENT_ATTACHMENT_LIMIT_BYTES = 5 * 1024 * 1024
const VIDEO_ATTACHMENT_LIMIT_BYTES = 10 * 1024 * 1024
const videoSubmissionFileExtensions = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".webm",
  ".wmv",
])

function getSubmissionFileExtension(fileName: string) {
  const extensionIndex = fileName.toLowerCase().lastIndexOf(".")
  return extensionIndex >= 0 ? fileName.toLowerCase().slice(extensionIndex) : ""
}

function isVideoSubmissionFile(file: File) {
  const fileType = file.type.toLowerCase()
  const extension = getSubmissionFileExtension(file.name)

  return fileType.startsWith("video/") || videoSubmissionFileExtensions.has(extension)
}

function getSubmissionFileSizeLimit(file: File) {
  return isVideoSubmissionFile(file)
    ? VIDEO_ATTACHMENT_LIMIT_BYTES
    : DOCUMENT_ATTACHMENT_LIMIT_BYTES
}

function formatAttachmentLimit(limit: number) {
  return `${Math.round(limit / (1024 * 1024))} MB`
}

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

function splitFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".")

  if (dotIndex <= 0) {
    return {
      baseName: fileName,
      extension: "",
    }
  }

  return {
    baseName: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex),
  }
}

function createVersionedFileName(fileName: string, usedFileNames: Set<string>) {
  const trimmedName = fileName.trim() || "submission"
  const normalizedName = trimmedName.toLowerCase()

  if (!usedFileNames.has(normalizedName)) {
    usedFileNames.add(normalizedName)
    return trimmedName
  }

  const { baseName, extension } = splitFileName(trimmedName)
  let version = 1

  while (true) {
    const candidate = `${baseName} (${version})${extension}`
    const normalizedCandidate = candidate.toLowerCase()

    if (!usedFileNames.has(normalizedCandidate)) {
      usedFileNames.add(normalizedCandidate)
      return candidate
    }

    version += 1
  }
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

    const oversizedFile = files.find((file) => file.size > getSubmissionFileSizeLimit(file))

    if (oversizedFile) {
      const limit = getSubmissionFileSizeLimit(oversizedFile)
      return NextResponse.json(
        {
          error: `The limit is ${formatAttachmentLimit(limit)} for ${
            isVideoSubmissionFile(oversizedFile) ? "videos" : "documents and images"
          }.`,
        },
        { status: 400 }
      )
    }

    const existingSubmissions = await listBacklogSubmissions(id, user.id)
    const usedFileNames = new Set(
      existingSubmissions.map((submission) => submission.fileName.trim().toLowerCase())
    )

    const submissions = await Promise.all(
      files.map(async (file) => {
        const submissionId = randomUUID()
        const versionedFileName = createVersionedFileName(file.name, usedFileNames)
        const safeName = sanitizeFileName(versionedFileName) || "submission"
        const bytes = Buffer.from(await file.arrayBuffer())

        return createBacklogSubmission({
          id: submissionId,
          backlogItemId: id,
          fileName: versionedFileName,
          fileUrl: `/api/backlog-items/${id}/submissions/file?submissionId=${encodeURIComponent(submissionId)}&filename=${encodeURIComponent(safeName)}`,
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
