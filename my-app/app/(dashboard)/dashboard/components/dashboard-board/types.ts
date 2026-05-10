import type { DashboardComment, DashboardSubmission, TodoItem } from "../../types"

export type SubmissionDraft = {
  id: string
  file: File
  progress: number
  status: "pending" | "uploading" | "complete" | "error"
}

export type OpenTaskTarget = "default" | "comments"

export type CreateSubtaskInput = {
  title: string
  description: string
  startDate?: string
  dueDate?: string
}

export type DashboardBoardProps = {
  todos: TodoItem[]
  currentUserId?: string | null
  creatorNamesById?: Record<string, string>
  canManageOtherProjectResources?: boolean
  canMoveToSprint?: boolean
  isSprintView?: boolean
  currentSprintId?: string | null
  sprints: Array<{
    id: string
    name: string
    backlogItemIds: string[]
  }>
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onMoveTodo: (
    todoId: string,
    targetTodoId: string | null,
    nextStatus: TodoItem["status"]
  ) => Promise<void>
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onAddToSprint: (todoId: string, sprintId: string) => Promise<void> | void
  onMoveToBoard: (todoId: string, sprintId: string) => Promise<void> | void
  onTodoUpdate: (todoId: string, updates: Partial<TodoItem>) => void
  onCreateSubtask: (
    parentTodo: TodoItem,
    input: CreateSubtaskInput
  ) => Promise<void>
  isCreatingSubtask?: boolean
  createSubtaskError?: string | null
  onCreateSubtaskInputChange?: () => void
  onUpdateSubtask: (
    subtaskId: string,
    updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
  ) => Promise<void>
  onDeleteSubtask: (parentTodoId: string, subtaskId: string) => Promise<void>
  onDeleteTodo: (todo: TodoItem) => Promise<void>
  onArchiveTodo: (todo: TodoItem) => Promise<void>
}

export type CommentThreads = Record<string, DashboardComment[]>
export type SubmissionThreads = Record<string, DashboardSubmission[]>
export type AssetMap = Record<string, string[]>
export type SubmissionDraftMap = Record<string, SubmissionDraft[]>
export type SubmissionActionsMap = Record<string, boolean>
