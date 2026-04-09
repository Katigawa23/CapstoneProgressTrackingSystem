import type { BacklogApiItem, ColumnId, TodoItem } from "./types"
import { getAssigneeOption } from "./backlog/types"

const fallbackDescription =
  "Write a 1000-word article discussing the latest advancements and trends."

export function formatDeadline(dateString: string) {
  if (!dateString) return "No deadline"

  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) return dateString

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function isDashboardColumn(status: string): status is ColumnId {
  return (
    status === "todo" ||
    status === "inprogress" ||
    status === "revision" ||
    status === "completed"
  )
}

export function mapBacklogItemsToTodos(items: BacklogApiItem[]): TodoItem[] {
  return items
    .filter((item): item is BacklogApiItem & { status: ColumnId } =>
      isDashboardColumn(item.status)
    )
    .map((item) => {
      const assignee = getAssigneeOption(item.assigneeId)

      return {
        id: item.id,
        title: item.title,
        description: item.description || fallbackDescription,
        assignee: assignee?.name ?? "",
        assigneeId: item.assigneeId ?? null,
        startDate: item.startDate ?? "",
        deadline: item.dueDate ?? "",
        status: item.status,
        comments: 0,
        links: 0,
        checklist: "0/0",
        priority:
          item.status === "revision"
            ? "High"
            : item.status === "completed"
            ? "Low"
            : "Medium",
      }
    })
}
