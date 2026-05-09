import { NextResponse } from "next/server"

import { getBacklogSubmissionAsset } from "@backend/repositories/backlog-attachment-repository"
import { requireAuthenticatedUser } from "@/lib/server-auth"

export const runtime = "nodejs"

function getContentDisposition(fileName: string, download: boolean) {
  const safeFileName = fileName.replace(/["\\\r\n]/g, "_")
  const encodedFileName = encodeURIComponent(fileName)

  return `${download ? "attachment" : "inline"}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser()
    const { id } = await params
    const url = new URL(request.url)
    const submissionId = url.searchParams.get("submissionId")?.trim()
    const shouldDownload = url.searchParams.get("download") === "1"

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 }
      )
    }

    const asset = await getBacklogSubmissionAsset(id, submissionId, user.id)

    if (!asset) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    if (!asset.fileData) {
      return NextResponse.redirect(new URL(asset.fileUrl, request.url))
    }

    const fileBody = asset.fileData.buffer.slice(
      asset.fileData.byteOffset,
      asset.fileData.byteOffset + asset.fileData.byteLength
    )

    return new NextResponse(fileBody as BodyInit, {
      headers: {
        "Content-Type": asset.fileType || "application/octet-stream",
        "Content-Length": String(asset.fileSize),
        "Content-Disposition": getContentDisposition(
          asset.fileName,
          shouldDownload
        ),
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isAuthError = errorMessage === "Unauthorized"

    return NextResponse.json(
      { error: "Failed to load submission file", details: errorMessage },
      { status: isAuthError ? 401 : 500 }
    )
  }
}
