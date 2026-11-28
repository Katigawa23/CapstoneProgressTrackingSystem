import { NextResponse } from "next/server"

import { getBacklogCompletionLock } from "@backend/repositories/tasks-repository"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { listProjects } from "@/lib/server-project-repository"
import { getResearchProgress, saveResearchProgress } from "@/lib/server-research-progress"
import { getTaskSurveyAccess, listTaskSurveys } from "@/lib/server-task-survey"

type Context = { params: Promise<{ id: string }> }
const noStore = { headers: { "Cache-Control": "no-store" } }

async function getResearchTask(userId: string, taskId: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(taskId)) return null
  const task = await getBacklogCompletionLock(taskId)
  if (!task) return null
  const project = (await listProjects(userId)).find(({ id }) => id === task.projectId)
  return project ? { task, approach: project.researchApproach } : null
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await readAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    const context = await getResearchTask(user.id, id)
    if (!context) return NextResponse.json({ error: "Task not found" }, { status: 404 })
    if (!context.approach) return NextResponse.json({ approach: null, progress: null }, noStore)
    const progress = await getResearchProgress(id)
    const survey = await getTaskSurveyAccess(id, user, false)
    const surveys = survey ? await listTaskSurveys(id) : []
    return NextResponse.json({ approach: context.approach, progress, surveys, canAccessSurveys: Boolean(survey), survey: survey && {
      published: survey.published, hasSurvey: survey.hasSurvey, title: survey.surveyTitle, closed: survey.surveyClosed,
    } }, noStore)
  } catch (error) {
    console.error("Failed to load research progress", error)
    return NextResponse.json({ error: "Could not load research progress." }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await readAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const origin = request.headers.get("origin")
    const fetchSite = request.headers.get("sec-fetch-site")
    if (user.role !== "student" || !origin || (fetchSite ? fetchSite !== "same-origin" : origin !== new URL(request.url).origin)) {
      return NextResponse.json({ error: "Only students in the group can save research progress." }, { status: 403 })
    }
    const { id } = await params
    const context = await getResearchTask(user.id, id)
    if (!context?.approach) return NextResponse.json({ error: "Research task not found" }, { status: 404 })
    if (context.task.completed || context.task.ancestorCompleted) {
      return NextResponse.json({ error: "Completed tasks are locked." }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const { target, completed, revision } = body ?? {}
    if (!Number.isInteger(target) || target < 1 || target > 1000000 || !Number.isInteger(completed) ||
        completed < 0 || completed > target || !(revision === null || (typeof revision === "string" && /^\d{1,19}$/.test(revision)))) {
      return NextResponse.json({ error: "Enter a whole-number target and a completed count between zero and the target." }, { status: 400 })
    }
    if (revision === null && !(await getTaskSurveyAccess(id, user, false))) {
      return NextResponse.json({ error: "Only students in the group can start a survey." }, { status: 403 })
    }
    const progress = await saveResearchProgress(id, context.task.projectId, user.id, { target, completed, revision })
    if (!progress) return NextResponse.json({ error: "The task changed. Reload the latest count before saving." }, { status: 409 })
    return NextResponse.json({ progress }, noStore)
  } catch (error) {
    console.error("Failed to save research progress", error)
    return NextResponse.json({ error: "Could not save research progress." }, { status: 500 })
  }
}
