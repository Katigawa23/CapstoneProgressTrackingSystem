import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { submitPublicSurvey } from "@/lib/server-task-survey"
import { isSurveyId, maxSurveyBytes } from "@/lib/task-survey"

async function readSubmission(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxSurveyBytes) { await reader.cancel(); return "large" as const }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const contents = Buffer.concat(chunks)
  const type = request.headers.get("content-type") ?? ""
  const files = new Map<number, File[]>()
  if (type.startsWith("application/json")) return { body: JSON.parse(contents.toString()), files }
  if (!type.startsWith("multipart/form-data")) return null
  const data = await new Response(new Uint8Array(contents), { headers: { "Content-Type": type } }).formData()
  const body = JSON.parse(String(data.get("response") ?? ""))
  for (const [key, value] of data) {
    if (typeof value === "string" || !/^file-(0|[1-9]\d?)$/.test(key)) continue
    const index = Number(key.slice(5))
    files.set(index, [...(files.get(index) ?? []), value])
  }
  return { body, files }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")
    if (!origin || (fetchSite ? fetchSite !== "same-origin" : origin !== new URL(request.url).origin)) {
      return NextResponse.json({ error: "Open the original survey page to submit." }, { status: 403 })
    }
    if (Number(request.headers.get("content-length")) > maxSurveyBytes) {
      return NextResponse.json({ error: "Keep all attachments under 4 MB combined." }, { status: 413 })
    }
    const { token } = await params
    const input = await readSubmission(request).catch(() => null)
    if (input === "large") return NextResponse.json({ error: "Keep all attachments under 4 MB combined." }, { status: 413 })
    if (!input || !isSurveyId(token) || !isSurveyId(input.body?.submissionId) || input.body?.consent !== true) {
      return NextResponse.json({ error: "A valid response and consent are required." }, { status: 400 })
    }
    const user = await readAuthenticatedUser(true)
    const result = await submitPublicSurvey(token, input.body.submissionId, input.body.answers, input.files, user, input.body.email)
    if (result.status === "closed") return NextResponse.json({ error: "This survey is closed." }, { status: 409 })
    if (result.status === "duplicate") return NextResponse.json({ error: "You have already submitted this survey." }, { status: 409 })
    if (result.status === "signIn") return NextResponse.json({ error: "Sign in before submitting." }, { status: 401 })
    if (result.status === "invalid") return NextResponse.json({
      error: "Check the answers marked below.", errors: result.errors, emailError: result.emailError,
    }, { status: 400 })
    return NextResponse.json({ saved: true, confirmation: result.confirmation }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Could not save public survey response", error)
    return NextResponse.json({ error: "Could not save your response. Please try again." }, { status: 500 })
  }
}
