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

export function buildTaskDisplayId(projectCode: string, sequenceNumber: number) {
  return `${projectCode}-${sequenceNumber}`
}

export function mapBacklogItemsToTodos(
  items: BacklogApiItem[],
  projectCode: string
): TodoItem[] {
  const childItemsByParentId = new Map<
    string,
    Array<BacklogApiItem & { parentId: string }>
  >()
  const rootDisplayIdById = new Map<string, string>()

  for (const item of items) {
    if (!item.parentId) {
      rootDisplayIdById.set(
        item.id,
        buildTaskDisplayId(projectCode, item.sequenceNumber)
      )
      continue
    }

    const currentChildren = childItemsByParentId.get(item.parentId) ?? []
    currentChildren.push(item as BacklogApiItem & { parentId: string })
    childItemsByParentId.set(item.parentId, currentChildren)
  }

  for (const childItems of childItemsByParentId.values()) {
    childItems.sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  }

  return items
    .filter((item): item is BacklogApiItem & { status: ColumnId } =>
      isDashboardColumn(item.status)
    )
    .map((item) => {
      const assignee = getAssigneeOption(item.assigneeId)
      const childItems = childItemsByParentId.get(item.id) ?? []
      const completedSubtasks = childItems.filter((child) => child.checked).length
      const displayId = item.parentId
        ? (() => {
            const siblingItems = childItemsByParentId.get(item.parentId) ?? []
            const siblingIndex = siblingItems.findIndex(
              (sibling) => sibling.id === item.id
            )
            const parentDisplayId =
              rootDisplayIdById.get(item.parentId) ??
              buildTaskDisplayId(projectCode, item.sequenceNumber)

            return `${parentDisplayId} / ST-${Math.max(siblingIndex + 1, 1)}`
          })()
        : rootDisplayIdById.get(item.id) ??
          buildTaskDisplayId(projectCode, item.sequenceNumber)

      return {
        id: item.id,
        displayId,
        orderIndex: item.orderIndex,
        parentId: item.parentId ?? null,
        title: item.title,
        description:
          item.description || (item.parentId ? "" : fallbackDescription),
        assignee: assignee?.name ?? "",
        assigneeId: item.assigneeId ?? null,
        startDate: item.startDate ?? "",
        deadline: item.dueDate ?? "",
        status: item.status,
        checked: item.checked,
        comments: item.commentCount ?? 0,
        links: 0,
        checklist: `${completedSubtasks}/${childItems.length}`,
        priority:
          item.status === "revision"
            ? "High"
            : item.status === "completed"
            ? "Low"
            : "Medium",
      }
    })
}
