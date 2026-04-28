import { revalidateTag } from "next/cache"
import { randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  createBacklogSubmission,
  deleteBacklogSubmission,
  listBacklogSubmissions,
} from "@backend/repositories/backlog-submission-repository"

export const runtime = "nodejs"

const uploadRoot = path.join(
  process.cwd(),
  "public",
  "uploads",
  "backlog-submissions"
)

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
    console.error("Failed to load backlog submissions", error)
    return NextResponse.json(
      { error: "Failed to load backlog submissions" },
      { status: 500 }
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

    const itemUploadRoot = path.join(uploadRoot, id)
    await mkdir(itemUploadRoot, { recursive: true })

    const submissions = await Promise.all(
      files.map(async (file) => {
        const safeName = sanitizeFileName(file.name) || "submission"
        const storedName = `${randomUUID()}-${safeName}`
        const outputPath = path.join(itemUploadRoot, storedName)
        const bytes = Buffer.from(await file.arrayBuffer())

        await writeFile(outputPath, bytes)

        return createBacklogSubmission({
          backlogItemId: id,
          fileName: file.name,
          fileUrl: `/uploads/backlog-submissions/${id}/${storedName}`,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
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
    return NextResponse.json(
      { error: "Failed to upload backlog submissions" },
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

    const deletedSubmission = await deleteBacklogSubmission(id, submissionId, user.id)

    if (!deletedSubmission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    if (deletedSubmission.fileUrl.startsWith("/uploads/backlog-submissions/")) {
      const relativePath = deletedSubmission.fileUrl.replace(/^\/+/, "")
      const filePath = path.join(process.cwd(), "public", relativePath)

      try {
        await unlink(filePath)
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : null

        if (code !== "ENOENT") {
          throw error
        }
      }
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
