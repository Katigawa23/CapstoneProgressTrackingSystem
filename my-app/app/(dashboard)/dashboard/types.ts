export type ColumnId = "todo" | "inprogress" | "revision" | "completed"

export type TodoItem = {
  id: string
  title: string
  description: string
  assignee: string
  deadline: string
  status: ColumnId
  comments: number
  links: number
  checklist: string
  priority: "Low" | "Medium" | "High"
}

export type BacklogApiItem = {
  id: string
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId?: string | null
  createdAt?: string
}

export type DashboardComment = {
  id: string
  backlogItemId: string
  author: string
  body: string
  attachments: string[]
  createdAt: string
}
