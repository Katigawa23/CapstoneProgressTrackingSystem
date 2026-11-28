export const taskStatuses = ["todo", "inprogress", "inreview", "revision", "completed"] as const

export type TaskStatus = (typeof taskStatuses)[number]
export const boardStatusIds = ["todo", "inprogress", "revision", "completed"] as const
export type CustomTaskStatus = `custom-${string}`
export type BoardStatus = (typeof boardStatusIds)[number] | CustomTaskStatus
export type ProjectBoardColumn = { id: BoardStatus; label: string | null; wipLimit?: number }
export const maxCustomTaskStatuses = 6
export const maxProjectWipLimit = 999

export function isCustomTaskStatus(value: unknown): value is CustomTaskStatus {
  return typeof value === "string" && /^custom-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
}
export const defaultProjectBoardColumns: readonly ProjectBoardColumn[] =
  boardStatusIds.map((id) => ({ id, label: null }))

export function readProjectBoardColumns(value: unknown): ProjectBoardColumn[] | null {
  if (!Array.isArray(value) || value.length < boardStatusIds.length ||
      value.length > boardStatusIds.length + maxCustomTaskStatuses) return null
  const columns: ProjectBoardColumn[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null
    const { id, label, wipLimit } = entry as Partial<ProjectBoardColumn>
    if (!id || (!boardStatusIds.some((status) => status === id) && !isCustomTaskStatus(id)) ||
        columns.some((column) => column.id === id)) return null
    if (label !== null && (typeof label !== "string" || !label.trim() || label.trim().length > 40)) return null
    if (isCustomTaskStatus(id) && label === null) return null
    if (wipLimit !== undefined && (id === "todo" || id === "completed" ||
        !Number.isInteger(wipLimit) || wipLimit < 1 || wipLimit > maxProjectWipLimit)) return null
    columns.push({ id, label: label?.trim() ?? null, ...(wipLimit !== undefined ? { wipLimit } : {}) })
  }
  return boardStatusIds.every((id) => columns.some((column) => column.id === id)) ? columns : null
}

export type TaskTransition = {
  from: TaskStatus | CustomTaskStatus
  to: TaskStatus | CustomTaskStatus
  role: "student" | "faculty"
}

export function readProjectTaskTransitions(
  input: unknown,
  columns: readonly ProjectBoardColumn[] = defaultProjectBoardColumns
): TaskTransition[] | null {
  if (!Array.isArray(input) || input.length > 120) return null
  const states = new Set([...taskStatuses, ...columns.map((column) => column.id)])

  const transitions: TaskTransition[] = []
  for (const value of input) {
    if (!value || typeof value !== "object") return null
    const { from, to, role } = value as Partial<TaskTransition>
    if (!from || !to || !states.has(from) || !states.has(to) ||
        (role !== "student" && role !== "faculty") || from === to || from === "completed") return null
    if (isCustomTaskStatus(from) || isCustomTaskStatus(to)) {
      if (role !== "faculty" || to === "inreview") return null
    } else if (!canTransitionTaskStatus(from, to, role)) return null
    if (transitions.some((entry) => entry.from === from && entry.to === to && entry.role === role)) return null
    transitions.push({ from, to, role })
  }
  return transitions
}

export function hasCustomStatusExitPaths(columns: readonly ProjectBoardColumn[], transitions: readonly TaskTransition[]) {
  const exits = new Set<TaskTransition["to"]>(boardStatusIds)
  for (let step = 0; step < columns.length; step++) {
    for (const { from, to } of transitions) {
      if (exits.has(to)) exits.add(from)
    }
  }
  return columns.every(({ id }) => exits.has(id))
}

export const legacyTaskTransitions: TaskTransition[] = (["student", "faculty"] as const)
  .flatMap((role) => taskStatuses.flatMap((from) => taskStatuses
    .filter((to) => canTransitionTaskStatus(from, to, role))
    .map((to) => ({ from, to, role }))))

export function canTransitionTaskStatus(
  current: string,
  next: string,
  role: "student" | "faculty" | "admin",
  projectTransitions?: readonly TaskTransition[]
) {
  if (projectTransitions) {
    return projectTransitions.some((transition) =>
      transition.from === current && transition.to === next && transition.role === role
    )
  }
  if (current === next || current === "completed" || role === "admin") return false
  if (role === "student") return current === "todo" && next === "inprogress"

  if (current === "revision") return next === "completed"
  if (current === "inprogress" || current === "inreview") {
    return next === "revision" || next === "completed"
  }

  return current === "todo" && ["inprogress", "revision", "completed"].includes(next)
}
