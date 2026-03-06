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
  description?: string
  dueDate: string | null
  status: string
}
