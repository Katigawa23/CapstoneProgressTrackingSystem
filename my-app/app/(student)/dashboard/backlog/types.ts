export type UploadItem = {
  name: string
  size: string
  type: string
}

export type StatusOption = {
  value: string
  label: string
  color: string
}

export type WorkItem = {
  id: string
  title: string
  dueDate?: Date
  description: string
  status: string
  checked: boolean
  file: UploadItem | null
}

export const statusOptions: StatusOption[] = [
  {
    value: "todo",
    label: "Todo",
    color: "border-blue-200 bg-blue-100 text-blue-700",
  },
  {
    value: "inprogress",
    label: "In Progress",
    color: "border-yellow-200 bg-yellow-100 text-yellow-700",
  },
  {
    value: "inreview",
    label: "In Review",
    color: "border-purple-200 bg-purple-100 text-purple-700",
  },
  {
    value: "revision",
    label: "Revision",
    color: "border-orange-200 bg-orange-100 text-orange-700",
  },
  {
    value: "completed",
    label: "Completed",
    color: "border-green-200 bg-green-100 text-green-700",
  },
]

export function getStatusOption(value: string) {
  return statusOptions.find((option) => option.value === value) ?? statusOptions[0]
}
