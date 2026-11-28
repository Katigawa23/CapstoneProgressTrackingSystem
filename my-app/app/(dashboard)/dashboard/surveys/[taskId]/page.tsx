import { randomUUID } from "node:crypto"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getBacklogCompletionLock } from "@backend/repositories/tasks-repository"
import { Button } from "@/components/ui/button"
import { getTaskSurveyAccess, listTaskSurveys } from "@/lib/server-task-survey"
import { isSurveyId } from "@/lib/task-survey"
import { TaskSurveyPanel } from "../../components/dashboard-board/task-survey-panel"

export default async function SurveyWorkspace({ params, searchParams }: {
  params: Promise<{ taskId: string }>
  searchParams: Promise<{ survey?: string | string[]; new?: string }>
}) {
  const { taskId } = await params
  const access = await getTaskSurveyAccess(taskId)
  if (!access) notFound()

  const task = await getBacklogCompletionLock(taskId)
  if (!task) notFound()

  const canManage = access.user.role === "student" && !task.completed && !task.ancestorCompleted
  const query = await searchParams
  if (query.new === "1" || (!query.survey && !access.surveyToken)) {
    if (!canManage) notFound()
    redirect(`/dashboard/surveys/${taskId}?survey=${randomUUID()}`)
  }
  const token = query.survey ?? access.surveyToken
  if (!isSurveyId(token)) notFound()
  if (!canManage && token !== access.surveyToken && !(await listTaskSurveys(taskId)).some((survey) => survey.token === token)) notFound()
  const boardQuery = new URLSearchParams({ projectId: access.projectId, taskId })

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <header className="space-y-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/board?${boardQuery}`}>Back to task</Link>
        </Button>
        <h1 className="break-words text-2xl font-semibold">{access.taskTitle}</h1>
      </header>
      <TaskSurveyPanel key={token} taskId={taskId} surveyToken={token} canManage={canManage} />
    </section>
  )
}
