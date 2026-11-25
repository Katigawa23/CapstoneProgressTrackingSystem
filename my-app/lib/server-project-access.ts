import { getBacklogCompletionLock } from "@backend/repositories/tasks-repository"
import { listProjects } from "@/lib/server-project-repository"

export async function canAccessProject(projectId: string, userId: string) {
  const projects = await listProjects(userId)
  return projects.some((project) => project.id === projectId)
}

export async function canAccessTask(taskId: string, userId: string) {
  const task = await getBacklogCompletionLock(taskId)
  return task?.projectId ? canAccessProject(task.projectId, userId) : false
}
