import { Draggable, Droppable } from "@hello-pangea/dnd"
import { Ellipsis } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { columns } from "../../constants"
import type { TodoItem } from "../../types"
import { DashboardTaskCard } from "../dashboard-task-card"
import type { OpenTaskTarget } from "./types"

type DashboardColumnProps = {
  column: (typeof columns)[number]
  todos: TodoItem[]
  allTodos: TodoItem[]
  isSprintView?: boolean
  currentSprintId?: string | null
  currentUserId?: string | null
  canManageOtherProjectResources?: boolean
  canMoveToSprint?: boolean
  sprints: Array<{
    id: string
    name: string
    backlogItemIds: string[]
  }>
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onAddToSprint: (todoId: string, sprintId: string) => Promise<void> | void
  onMoveToBoard: (todoId: string, sprintId: string) => Promise<void> | void
  onOpenTask: (todo: TodoItem, target?: OpenTaskTarget) => void
  onArchiveTask: (todo: TodoItem) => void | Promise<void>
  onDeleteTask: (todo: TodoItem) => void | Promise<void>
  className?: string
  scrollAreaClassName?: string
}

export function DashboardColumn({
  column,
  todos,
  allTodos,
  isSprintView = false,
  currentSprintId = null,
  currentUserId = null,
  canManageOtherProjectResources = false,
  canMoveToSprint = true,
  sprints,
  onStatusChange,
  onAssigneeChange,
  onAddToSprint,
  onMoveToBoard,
  onOpenTask,
  onArchiveTask,
  onDeleteTask,
  className = "",
  scrollAreaClassName,
}: DashboardColumnProps) {
  const hasTodos = todos.length > 0
  const normalizedCurrentUserId = currentUserId?.trim() ?? ""

  return (
    <Droppable droppableId={column.id}>
      {(provided, snapshot) => (
        <Card
          className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl border-[color:var(--board-column-border)] bg-[var(--board-column-bg)] shadow-[var(--board-column-shadow)] transition-[background-color,border-color,box-shadow,transform] duration-300 ${
            snapshot.isDraggingOver
              ? "border-[var(--board-drop-border)] bg-[var(--board-drop-bg)] ring-2 ring-[var(--board-drop-ring)]"
              : ""
          } ${className}`}
        >
          <CardHeader className="px-0 pb-0 pt-1.5">
            <div className="px-3 pb-1.5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-1.5 text-xs font-semibold dark:text-slate-100">
                  <span className={`h-2 w-2 rounded-full ${column.color}`} />
                  <span className="truncate">{column.title}</span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    ({todos.length})
                  </span>
                </CardTitle>

                <button
                  type="button"
                  aria-label={`${column.title} actions`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-[background-color,color] duration-200 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-0 h-px w-full bg-slate-200 dark:bg-[#343434]" />
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={
                scrollAreaClassName ??
                `
                  board-column-scroll w-full ${
                    isSprintView
                      ? "h-[220px] overflow-visible sm:h-[250px] lg:h-[300px] xl:h-[360px]"
                      : "h-[240px] overflow-y-auto sm:h-[280px] lg:h-[340px] xl:h-[420px]"
                  }
                `
              }
            >
              <div className={`space-y-0.5 pt-0 pr-2 pb-2 ${hasTodos ? "" : "h-full"}`}>
                {todos.map((todo, index) => (
                  <Draggable
                    key={todo.id}
                    draggableId={todo.id}
                    index={index}
                  >
                    {(draggableProvided, dragSnapshot) => (
                      <DashboardTaskCard
                        todo={todo}
                        parentTaskTitle={
                          todo.parentId
                            ? allTodos.find((candidate) => candidate.id === todo.parentId)?.title ?? null
                            : null
                        }
                        isDragging={dragSnapshot.isDragging}
                        sprints={sprints}
                        isSprintView={isSprintView}
                        currentSprintId={currentSprintId}
                        canMoveToSprint={canMoveToSprint}
                        canArchive={
                          canManageOtherProjectResources ||
                          (Boolean(normalizedCurrentUserId) &&
                            todo.createdByUserId === normalizedCurrentUserId)
                        }
                        canDelete={
                          canManageOtherProjectResources ||
                          (Boolean(normalizedCurrentUserId) &&
                            todo.createdByUserId === normalizedCurrentUserId)
                        }
                        onStatusChange={onStatusChange}
                        onAssigneeChange={onAssigneeChange}
                        onAddToSprint={onAddToSprint}
                        onMoveToBoard={onMoveToBoard}
                        onOpen={onOpenTask}
                        onArchive={onArchiveTask}
                        onDelete={onDeleteTask}
                        draggableProvided={draggableProvided}
                        dragSnapshot={dragSnapshot}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Droppable>
  )
}
