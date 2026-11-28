import { NextResponse } from "next/server"

import { readAuthenticatedUser } from "@/lib/server-auth"
import { listProjects } from "@/lib/server-project-repository"
import { canPersistProjectWorkflow, getProjectWorkflow, saveProjectWorkflow } from "@/lib/server-project-workflow"
import { hasCustomStatusExitPaths, readProjectBoardColumns, readProjectTaskTransitions } from "@/lib/task-status-transitions"

type RouteContext = { params: Promise<{ id: string }> }

const noStore = { headers: { "Cache-Control": "no-store" } }

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const project = (await listProjects(user.id)).find((candidate) => candidate.id === id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  return NextResponse.json({
    workflow: await getProjectWorkflow(project.id),
    canEdit: user.role !== "student" && user.id !== "tester-admin" &&
      project.ownerUserId === user.id && canPersistProjectWorkflow(),
  }, noStore)
}

export async function PUT(request: Request, { params }: RouteContext) {
  const user = await readAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  const { id } = await params
  const project = (await listProjects(user.id)).find((candidate) => candidate.id === id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  if (user.role === "student" || user.id === "tester-admin" || project.ownerUserId !== user.id) {
    return NextResponse.json({ error: "Only the project owner can edit the workflow" }, { status: 403 })
  }
  if (!canPersistProjectWorkflow()) {
    return NextResponse.json({ error: "Workflow editing requires database storage" }, { status: 409 })
  }

  const body = await request.json().catch(() => null) as {
    revision?: unknown; transitions?: unknown; boardColumns?: unknown; requiresChapter?: unknown
  } | null
  const revision = body?.revision
  const requiresChapter = body?.requiresChapter
  const boardColumns = body?.boardColumns === undefined ? undefined : readProjectBoardColumns(body.boardColumns)
  const currentWorkflow = await getProjectWorkflow(project.id)
  const transitions = readProjectTaskTransitions(body?.transitions, boardColumns ?? currentWorkflow.boardColumns)
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0 ||
      revision >= 2147483647 || !transitions || boardColumns === null ||
      (requiresChapter !== undefined && typeof requiresChapter !== "boolean")) {
    return NextResponse.json({ error: "Invalid workflow configuration" }, { status: 400 })
  }
  if (boardColumns && currentWorkflow.boardColumns.some(({ id }) => !boardColumns.some((column) => column.id === id))) {
    return NextResponse.json({ error: "Saved states must be kept to preserve existing tasks and history." }, { status: 400 })
  }
  if (!hasCustomStatusExitPaths(boardColumns ?? currentWorkflow.boardColumns, transitions)) {
    return NextResponse.json({ error: "Every custom status needs a path back to a standard status." }, { status: 400 })
  }

  const workflow = await saveProjectWorkflow(project.id, user.id, revision, transitions, boardColumns, requiresChapter)
  if (!workflow) {
    return NextResponse.json({ error: "The project or workflow changed. Reload before saving." }, { status: 409 })
  }
  return NextResponse.json({ workflow }, noStore)
}
