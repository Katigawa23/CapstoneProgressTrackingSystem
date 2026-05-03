import {
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd"
import { ChevronDown, GripVertical, Plus } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

import { type StatusOption, type WorkItem } from "../types"
import { AssigneeCombobox } from "./assignee-combobox"
import { ItemActionsMenu } from "./item-actions-menu"
import { StatusCombobox } from "./status-combobox"

type BacklogBoardProps = {
  title?: string
  droppableId: string
  items: WorkItem[]
  statusCounts: Array<StatusOption & { count: number }>
  onToggleCheckbox: (id: string, checked: boolean) => void
  onToggleAllCheckboxes: (checked: boolean) => void
  onUpdateStatus: (id: string, nextStatus: string) => void
  onUpdateAssignee: (id: string, assigneeId: string | null) => void
  onEditItem: (item: WorkItem) => void
  onDeleteItem: (id: string) => void
  onOpenCreate?: () => void
}

export function BacklogBoard({
  title = "Board",
  droppableId,
  items,
  statusCounts,
  onToggleCheckbox,
  onToggleAllCheckboxes,
  onUpdateStatus,
  onUpdateAssignee,
  onEditItem,
  onDeleteItem,
  onOpenCreate,
}: BacklogBoardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [expandedParentIds, setExpandedParentIds] = React.useState<Set<string>>(
    () => new Set()
  )
  const checkedItemsCount = items.filter((item) => item.checked).length
  const allItemsChecked = items.length > 0 && checkedItemsCount === items.length
  const hasPartiallyCheckedItems = checkedItemsCount > 0 && checkedItemsCount < items.length
  const rootItems = React.useMemo(
    () => items.filter((item) => !item.parentId),
    [items]
  )
  const childItemsByParentId = React.useMemo(() => {
    const childMap = new Map<string, WorkItem[]>()

    for (const item of items) {
      if (!item.parentId) {
        continue
      }

      const currentChildren = childMap.get(item.parentId) ?? []
      currentChildren.push(item)
      childMap.set(item.parentId, currentChildren)
    }

    return childMap
  }, [items])
  const rootItemIds = React.useMemo(
    () => new Set(rootItems.map((item) => item.id)),
    [rootItems]
  )
  const orphanItems = React.useMemo(
    () =>
      items.filter(
        (item) => item.parentId && !rootItemIds.has(item.parentId)
      ),
    [items, rootItemIds]
  )

  React.useEffect(() => {
    setExpandedParentIds((current) => {
      const next = new Set<string>()

      for (const item of rootItems) {
        if (childItemsByParentId.has(item.id) && current.has(item.id)) {
          next.add(item.id)
        }
      }

      return next
    })
  }, [childItemsByParentId, rootItems])

  const renderItemRow = React.useCallback(
    (
      item: WorkItem,
      dragHandleProps?: DraggableProvidedDragHandleProps | null,
      options?: {
        hasChildren?: boolean
        isChildrenExpanded?: boolean
        onToggleChildren?: (() => void) | null
      }
    ) => (
      <div
        className={cn(
          "flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-0.5 text-sm transition hover:bg-muted/30 dark:border-[#343434] dark:bg-[#1f1f1f] dark:hover:bg-[#262626]",
          item.parentId ? "ml-6 border-dashed" : ""
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {!item.parentId ? (
            <button
              type="button"
              {...dragHandleProps}
              className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-slate-400 transition hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
              aria-label={`Drag ${item.title}`}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {!item.parentId && options?.hasChildren ? (
            <button
              type="button"
              onClick={options.onToggleChildren}
              className="flex h-5 w-4 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              aria-expanded={options.isChildrenExpanded}
              aria-label={
                options.isChildrenExpanded
                  ? `Collapse subtasks for ${item.title}`
                  : `Expand subtasks for ${item.title}`
              }
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  options.isChildrenExpanded ? "" : "-rotate-90"
                )}
              />
            </button>
          ) : !item.parentId ? (
            <span className="h-5 w-4 shrink-0" aria-hidden="true" />
          ) : null}

          <Checkbox
            checked={item.checked}
            onCheckedChange={(checked) =>
              onToggleCheckbox(item.id, !!checked)
            }
            className="h-3.5 w-3.5"
          />

          <div className="min-w-0">
            <div className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              {item.displayId}
            </div>
            <div className="truncate text-[11px] font-medium text-black dark:text-slate-100">
              {item.title}
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400">
              {item.parentId ? "Subtask" : "Task"}
              {" | "}Due{" "}
              {item.dueDate
                ? item.dueDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "No due date"}
            </div>
          </div>
        </div>

        <div className="ml-2 flex items-center gap-1">
          <StatusCombobox
            value={item.status}
            onChange={(nextStatus) => onUpdateStatus(item.id, nextStatus)}
          />

          <AssigneeCombobox
            value={item.assigneeId}
            onChange={(assigneeId) =>
              onUpdateAssignee(item.id, assigneeId)
            }
          />

          <ItemActionsMenu
            onEdit={() => onEditItem(item)}
            onDelete={() => onDeleteItem(item.id)}
          />
        </div>
      </div>
    ),
    [onDeleteItem, onEditItem, onToggleCheckbox, onUpdateAssignee, onUpdateStatus]
  )

  return (
    <Card
      className={`flex flex-col gap-2.5 overflow-hidden border border-gray-200 bg-white p-2.5 dark:border-[#343434] dark:bg-[#1f1f1f] ${
        isExpanded ? "h-[280px] min-h-[280px]" : "h-auto min-h-0"
      } rounded-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="flex h-6 w-6 items-center justify-center text-black transition hover:text-black/70 dark:text-slate-100 dark:hover:text-slate-300"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${title.toLowerCase()} board` : `Expand ${title.toLowerCase()} board`}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
            />
          </button>
          <div className="flex items-center gap-1.5 pl-[2px]">
            <Checkbox
              checked={allItemsChecked ? true : hasPartiallyCheckedItems ? "indeterminate" : false}
              onCheckedChange={(checked) => onToggleAllCheckboxes(Boolean(checked))}
              aria-label={`Toggle all ${title.toLowerCase()} items`}
              className="h-3.5 w-3.5"
            />
            <div className="flex items-center gap-1.5 font-medium text-black dark:text-slate-100">
              <span>{title}</span>
              <span className="text-[12px] text-black/60 dark:text-slate-400">
                ({items.length} work item{items.length === 1 ? "" : "s"})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusCounts.map((status) => (
            <Badge
              key={status.value}
              variant="outline"
              className={cn(
                "h-4.5 min-w-4.5 rounded px-1 text-[9px] font-medium",
                status.color
              )}
            >
              {status.count}
            </Badge>
          ))}
        </div>
      </div>

      {!isExpanded ? (
        <div className="h-px w-full bg-gray-200 dark:bg-[#343434]" />
      ) : null}

      {!isExpanded ? null : items.length === 0 ? (
        <Droppable droppableId={droppableId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-gray-300 py-10 text-center text-sm text-black/60 dark:border-[#3a3a3a] dark:text-slate-400",
                snapshot.isDraggingOver ? "border-sky-300 bg-sky-50/50 dark:border-sky-700 dark:bg-sky-950/20" : ""
              )}
            >
              There&apos;s nothing on this board
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Droppable droppableId={droppableId}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "space-y-1 rounded-sm",
                  snapshot.isDraggingOver ? "bg-slate-50/70 dark:bg-[#262626]" : ""
                )}
              >
                {rootItems.map((item, index) => {
                  const childItems = childItemsByParentId.get(item.id) ?? []
                  const hasChildren = childItems.length > 0
                  const isChildrenExpanded = expandedParentIds.has(item.id)

                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(draggableProvided, dragSnapshot) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          className={cn(
                            "space-y-1",
                            dragSnapshot.isDragging ? "rounded-sm ring-2 ring-sky-200 dark:ring-sky-800" : ""
                          )}
                          style={draggableProvided.draggableProps.style}
                        >
                          {renderItemRow(item, draggableProvided.dragHandleProps, {
                            hasChildren,
                            isChildrenExpanded,
                            onToggleChildren: hasChildren
                              ? () =>
                                  setExpandedParentIds((current) => {
                                    const next = new Set(current)

                                    if (next.has(item.id)) {
                                      next.delete(item.id)
                                    } else {
                                      next.add(item.id)
                                    }

                                    return next
                                  })
                              : null,
                          })}
                          {hasChildren && isChildrenExpanded
                            ? childItems.map((childItem) => (
                                <div key={childItem.id}>
                                  {renderItemRow(childItem)}
                                </div>
                              ))
                            : null}
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {orphanItems.map((item) => (
                  <div key={item.id}>
                    {renderItemRow(item)}
                  </div>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}

      {onOpenCreate ? (
        <div className="flex shrink-0">
          <Button
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-black hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#2a2a2a]"
            onClick={onOpenCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
