import { Ellipsis } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { columns } from "../../constants"
import type { ColumnId, TodoItem } from "../../types"
import { DashboardTaskCard } from "../dashboard-task-card"
import type { OpenTaskTarget, Person } from "./types"

type DashboardColumnProps = {
  column: (typeof columns)[number]
  todos: TodoItem[]
  allTodos: TodoItem[]
  people: Person[]
  activeDropColumnId?: ColumnId | null
  draggingTodoId?: string | null
  activeDropTodoId?: string | null
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onDragStartTodo: (todoId: string) => void
  onDragEndTodo: () => void
  onDropTodoToColumn: (columnId: ColumnId) => void
  onDropTodoOnCard: (targetTodoId: string) => void
  onDragEnterColumn: (columnId: ColumnId) => void
  onDragEnterCard: (todoId: string, columnId: ColumnId) => void
  onOpenTask: (todo: TodoItem, target?: OpenTaskTarget) => void
  className?: string
  scrollAreaClassName?: string
}

export function DashboardColumn({
  column,
  todos,
  allTodos,
  people,
  activeDropColumnId,
  draggingTodoId,
  activeDropTodoId,
  onStatusChange,
  onAssigneeChange,
  onDragStartTodo,
  onDragEndTodo,
  onDropTodoToColumn,
  onDropTodoOnCard,
  onDragEnterColumn,
  onDragEnterCard,
  onOpenTask,
  className = "",
  scrollAreaClassName,
}: DashboardColumnProps) {
  const hasTodos = todos.length > 0
  const isDropTarget = activeDropColumnId === column.id

  return (
    <Card
      className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl transition ${
        isDropTarget
          ? "border-sky-300 bg-sky-50/30 ring-2 ring-sky-200 dark:border-sky-700 dark:bg-sky-950/10 dark:ring-sky-900"
          : "dark:border-[#343434] dark:bg-[#1f1f1f]"
      } ${className}`}
      onDragOver={(event) => {
        event.preventDefault()
        onDragEnterColumn(column.id)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropTodoToColumn(column.id)
      }}
    >
      <CardHeader className="px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold dark:text-slate-100">
            <span className={`h-2 w-2 rounded-full ${column.color}`} />
            <span className="truncate">{column.title}</span>
          </CardTitle>

          <button
            type="button"
            aria-label={`${column.title} actions`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
          >
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
        <ScrollArea
          className={
            scrollAreaClassName ??
            (hasTodos
              ? `
                  w-full max-h-[180px]
                  sm:max-h-[260px]
                  lg:max-h-[340px]
                  xl:max-h-[420px]
                `
              : "min-h-[170px] w-full")
          }
        >
          <div className={`space-y-2 p-0.5 pr-2 pb-2 ${hasTodos ? "" : "h-full"}`}>
            {todos.map((todo) => (
              <DashboardTaskCard
                key={todo.id}
                todo={todo}
                parentTaskTitle={
                  todo.parentId
                    ? allTodos.find((candidate) => candidate.id === todo.parentId)?.title ?? null
                    : null
                }
                people={people}
                isDragging={draggingTodoId === todo.id}
                showDropLine={activeDropTodoId === todo.id}
                onStatusChange={onStatusChange}
                onAssigneeChange={onAssigneeChange}
                onDragStart={onDragStartTodo}
                onDragEnd={onDragEndTodo}
                onDragEnterCard={(todoId) => onDragEnterCard(todoId, column.id)}
                onDropOnCard={onDropTodoOnCard}
                onOpen={onOpenTask}
              />
            ))}

            {todos.length === 0 && (
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                No tasks in this column.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
