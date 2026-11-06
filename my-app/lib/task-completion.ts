type TaskState = { id: string; parentId?: string | null; status: string }

export function hasCompletedTaskParent(task: TaskState, tasks: readonly TaskState[]) {
  const visited = new Set([task.id])
  let parentId = task.parentId
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = tasks.find((item) => item.id === parentId)
    if (!parent) return false
    if (parent.status === "completed") return true
    parentId = parent.parentId
  }
  return false
}

export function isTaskCompletionLocked(task: TaskState, tasks: readonly TaskState[]) {
  return task.status === "completed" || hasCompletedTaskParent(task, tasks)
}
