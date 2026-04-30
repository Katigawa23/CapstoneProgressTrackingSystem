export type ColumnId = "todo" | "inprogress" | "revision" | "completed"

export type TodoItem = {
  id: string
  displayId: string
  orderIndex: number
  parentId?: string | null
  title: string
  description: string
  assignee: string
  assigneeId?: string | null
  startDate: string
  deadline: string
  status: ColumnId
  checked?: boolean
  comments: number
  links: number
  checklist: string
  priority: "Low" | "Medium" | "High"
}

export type BacklogApiItem = {
  id: string
  sequenceNumber: number
  orderIndex: number
  projectId?: string
  parentId?: string | null
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId?: string | null
  createdAt?: string
  commentCount?: number
}

export type DashboardComment = {
  id: string
  backlogItemId: string
  authorUserId?: string | null
  author: string
  body: string
  attachments: string[]
  createdAt: string
}

export type DashboardSubmission = {
  id: string
  backlogItemId: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  uploadedAt: string
}
