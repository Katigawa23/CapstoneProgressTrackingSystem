import type { BacklogApiItem, ColumnId, TodoItem } from "./types"
import { getAssigneeOption } from "./backlog/types"
import { formatTrustedDate } from "@/lib/trusted-time"

const fallbackDescription =
  "Write a 1000-word article discussing the latest advancements and trends."

export function formatDeadline(dateString: string) {
  return formatTrustedDate(dateString)
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

export function buildSubtaskDisplayId(parentDisplayId: string, subtaskSequenceNumber: number) {
  return `${parentDisplayId}/ST-${subtaskSequenceNumber}`
}

export function mapBacklogItemsToTodos(
  items: BacklogApiItem[],
  projectCode: string
): TodoItem[] {
  const getNormalizedParentId = (parentId?: string | null) => {
    if (typeof parentId !== "string") {
      return null
    }

    const trimmedParentId = parentId.trim()
    return trimmedParentId.length > 0 ? trimmedParentId : null
  }

  const childItemsByParentId = new Map<
    string,
    Array<BacklogApiItem & { parentId: string }>
  >()
  const rootDisplayIdById = new Map<string, string>()

  for (const item of items) {
    const normalizedParentId = getNormalizedParentId(item.parentId)

    if (!normalizedParentId) {
      rootDisplayIdById.set(
        item.id,
        buildTaskDisplayId(projectCode, item.sequenceNumber)
      )
      continue
    }

    const normalizedItem = {
      ...item,
      parentId: normalizedParentId,
    } as BacklogApiItem & { parentId: string }
    const currentChildren = childItemsByParentId.get(normalizedParentId) ?? []

    currentChildren.push(normalizedItem)
    childItemsByParentId.set(normalizedParentId, currentChildren)
  }

  for (const childItems of childItemsByParentId.values()) {
    childItems.sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  }

  return items
    .filter((item): item is BacklogApiItem & { status: ColumnId } =>
      isDashboardColumn(item.status)
    )
    .map((item) => {
      const normalizedParentId = getNormalizedParentId(item.parentId)
      const assignee = getAssigneeOption(item.assigneeId)
      const childItems = childItemsByParentId.get(item.id) ?? []
      const completedSubtasks = childItems.filter((child) => child.checked).length
      const displayId = normalizedParentId
        ? (() => {
            const siblingItems = childItemsByParentId.get(normalizedParentId) ?? []
            const siblingIndex = siblingItems.findIndex(
              (sibling) => sibling.id === item.id
            )
            const parentDisplayId =
              rootDisplayIdById.get(normalizedParentId) ??
              buildTaskDisplayId(projectCode, item.sequenceNumber)

            return buildSubtaskDisplayId(parentDisplayId, Math.max(siblingIndex + 1, 1))
          })()
        : rootDisplayIdById.get(item.id) ??
          buildTaskDisplayId(projectCode, item.sequenceNumber)

      return {
        id: item.id,
        displayId,
        orderIndex: item.orderIndex,
        parentId: normalizedParentId,
        title: item.title,
        description:
          item.description || (normalizedParentId ? "" : fallbackDescription),
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
