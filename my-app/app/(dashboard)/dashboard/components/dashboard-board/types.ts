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
  onTodoUpdate: (todoId: string, updates: Partial<TodoItem>) => void
  onCreate: (status: ColumnId) => void
}

export type CommentThreads = Record<string, DashboardComment[]>
export type SubmissionThreads = Record<string, DashboardSubmission[]>
export type AssetMap = Record<string, string[]>
export type SubmissionDraftMap = Record<string, SubmissionDraft[]>
export type SubmissionActionsMap = Record<string, boolean>
