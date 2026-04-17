import type { ColumnId, DashboardComment, DashboardSubmission, TodoItem } from "../../types"

export type Person = {
  name: string
  src: string
}

export type SubmissionDraft = {
  id: string
  file: File
  progress: number
  status: "pending" | "uploading" | "complete" | "error"
}

export type OpenTaskTarget = "default" | "comments"

export type DashboardBoardProps = {
  todos: TodoItem[]
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onMoveTodo: (
    todoId: string,
    targetTodoId: string | null,
    nextStatus: TodoItem["status"]
  ) => Promise<void>
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onTodoUpdate: (todoId: string, updates: Partial<TodoItem>) => void
  onCreate: (status: ColumnId) => void
  onCreateSubtask: (parentTodo: TodoItem, title: string, description: string) => Promise<void>
  onUpdateSubtask: (
    subtaskId: string,
    updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
  ) => Promise<void>
  onDeleteSubtask: (parentTodoId: string, subtaskId: string) => Promise<void>
}

export type CommentThreads = Record<string, DashboardComment[]>
export type SubmissionThreads = Record<string, DashboardSubmission[]>
export type AssetMap = Record<string, string[]>
export type SubmissionDraftMap = Record<string, SubmissionDraft[]>
export type SubmissionActionsMap = Record<string, boolean>
