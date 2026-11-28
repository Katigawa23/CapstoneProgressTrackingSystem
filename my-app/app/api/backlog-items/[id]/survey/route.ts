import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getBacklogCompletionLock } from "@backend/repositories/tasks-repository"
import { countTaskSurveyResponses, exportTaskSurvey, getTaskSurveyAccess, getTaskSurvey, getTaskSurveyFile, saveTaskSurvey, setTaskSurveyClosed } from "@/lib/server-task-survey"
import { isSurveyId, readSurveyDefinition } from "@/lib/task-survey"

type Context = { params: Promise<{ id: string }> }
const noStore = { headers: { "Cache-Control": "private, no-store" } }

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params
    const access = await getTaskSurveyAccess(id)
    if (!access) return NextResponse.json({ error: "Survey task not found." }, { status: 404 })
    const query = new URL(request.url).searchParams
    const token = query.get("survey") ?? access.surveyToken
    if (token !== null && !isSurveyId(token)) return NextResponse.json({ error: "Invalid survey." }, { status: 400 })
    if (query.get("count") === "1") {
      return NextResponse.json({ responseCount: token ? await countTaskSurveyResponses(id, token) : 0 }, noStore)
    }
    const fileId = query.get("file")
    if (fileId !== null) {
      const file = token && isSurveyId(fileId) ? await getTaskSurveyFile(id, token, fileId) : null
      if (!file) return new Response(null, { status: 404 })
      return new Response(new Uint8Array(file.content), { headers: {
        ...noStore.headers,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16))}`,
        "X-Content-Type-Options": "nosniff",
      } })
    }
    if (query.get("export") === "csv") {
      const csv = token ? await exportTaskSurvey(id, token) : null
      if (!csv) return new Response(null, { status: 404 })
      return new Response(csv, { headers: {
        ...noStore.headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="survey-responses.csv"',
      } })
    }
    const page = Number(query.get("page") ?? 0)
    if (!Number.isSafeInteger(page) || page < 0 || page > 50000) {
      return NextResponse.json({ error: "Invalid response page." }, { status: 400 })
    }
    return NextResponse.json(await getTaskSurvey(id, token, page * 20), noStore)
  } catch (error) {
    console.error("Could not load task survey", error)
    return NextResponse.json({ error: "Could not load the survey." }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")
    if (!origin || (fetchSite ? fetchSite !== "same-origin" : origin !== new URL(request.url).origin)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
    }
    const { id } = await params
    const access = await getTaskSurveyAccess(id)
    if (access?.user.role !== "student") {
      return NextResponse.json({ error: "Only students in this group can manage the survey." }, { status: 403 })
    }
    const token = new URL(request.url).searchParams.get("survey") ?? access.surveyToken ?? randomUUID()
    if (!isSurveyId(token)) return NextResponse.json({ error: "Invalid survey." }, { status: 400 })
    const body = await request.json().catch(() => null)
    if (body?.action === "close" || body?.action === "reopen") {
      const task = await getBacklogCompletionLock(id)
      if (!task || task.completed || task.ancestorCompleted || !await setTaskSurveyClosed(id, token, body.action === "close")) {
        return NextResponse.json({ error: "Only an active task with a published survey can change submissions." }, { status: 409 })
      }
      return NextResponse.json(await getTaskSurvey(id, token, 0), noStore)
    }
    const definition = readSurveyDefinition(body, body?.action === "draft")
    if (!definition || (body.action !== "draft" && body.action !== "publish")) {
      return NextResponse.json({ error: "Check the title, questions, answer options, and section media before publishing." }, { status: 400 })
    }
    const task = await getBacklogCompletionLock(id)
    if (!task || task.completed || task.ancestorCompleted || !(await saveTaskSurvey(id, token, access.user.id, definition, body.action === "publish"))) {
      return NextResponse.json({ error: "Published surveys and closed tasks cannot be edited." }, { status: 409 })
    }
    return NextResponse.json(await getTaskSurvey(id, token, 0), noStore)
  } catch (error) {
    console.error("Could not save task survey", error)
    return NextResponse.json({ error: "Could not save the survey." }, { status: 500 })
  }
}
