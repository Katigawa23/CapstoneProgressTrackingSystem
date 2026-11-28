import {
  boardStatusIds,
  isCustomTaskStatus,
  legacyTaskTransitions,
  type ProjectBoardColumn,
  type TaskTransition,
} from "@/lib/task-status-transitions"

export const projectWorkflowPresets = {
  existing: { label: "Current workflow", description: "To-do, In Progress, Revision, and Completed." },
  kanban: { label: "Kanban board", description: "Ready, In Progress, Rework, and Done. Tasks can be created without chapters." },
  qa: { label: "QA review board", description: "Backlog, In Development, QA Rework, and Accepted. Tasks can be created without chapters." },
  academic: { label: "Academic review board", description: "Planned, Working, Adviser Revision, and Approved. Tasks require chapters." },
} as const

export type ProjectWorkflowPreset = keyof typeof projectWorkflowPresets

export function isProjectWorkflowPreset(value: unknown): value is ProjectWorkflowPreset {
  return typeof value === "string" && Object.hasOwn(projectWorkflowPresets, value)
}

const presetLabels = {
  kanban: { todo: "Ready", inprogress: null, revision: "Rework", completed: "Done" },
  qa: { todo: "Backlog", inprogress: "In Development", revision: "QA Rework", completed: "Accepted" },
  academic: { todo: "Planned", inprogress: "Working", revision: "Adviser Revision", completed: "Approved" },
} as const

export function createWorkflowFromPreset(
  preset: Exclude<ProjectWorkflowPreset, "existing">,
  current?: { boardColumns: ProjectBoardColumn[]; transitions: TaskTransition[] }
) {
  const columns = boardStatusIds.map((id) => ({ id, label: presetLabels[preset][id] }))
  const transitions = legacyTaskTransitions.filter(({ from, to, role }) =>
    preset === "kanban" || role !== "faculty" || from !== "todo" || to === "inprogress"
  )
  return {
    requiresChapter: preset === "academic",
    boardColumns: current?.boardColumns.map((column) => {
      const replacement = columns.find(({ id }) => id === column.id)
      return replacement ? { ...column, label: replacement.label } : column
    }) ?? columns,
    transitions: [
      ...transitions,
      ...(current?.transitions.filter(({ from, to }) => isCustomTaskStatus(from) || isCustomTaskStatus(to)) ?? []),
    ],
  }
}
