export type ColumnId = "todo" | "inprogress" | "revision" | "completed"

export type TodoItem = {
  id: string
  displayId: string
  orderIndex: number
  parentId?: string | null
  createdByUserId?: string | null
  archivedByUserId?: string | null
  deletedByUserId?: string | null
  title: string
  description: string
  assignee: string
  assigneeId?: string | null
  startDate: string
  deadline: string
  status: ColumnId
  checked?: boolean
  archived?: boolean
  archivedAt?: string | null
  deleted?: boolean
  deletedAt?: string | null
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
  createdByUserId?: string | null
  archivedByUserId?: string | null
  deletedByUserId?: string | null
  title: string
  description: string
  startDate: string | null
  dueDate: string | null
  status: string
  checked: boolean
  assigneeId?: string | null
  archived?: boolean
  archivedAt?: string | null
  deleted?: boolean
  deletedAt?: string | null
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
  uploadedByUserId?: string | null
  fileName: string
  fileUrl: string
  driveFileId?: string | null
  fileType: string
  fileSize: number
  uploadedAt: string
}

export type DashboardWebLink = {
  id: string
  backlogItemId: string
  uploadedByUserId?: string | null
  url: string
  label: string
  uploadedAt: string
}
