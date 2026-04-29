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
      className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl border-[color:var(--board-column-border)] bg-[var(--board-column-bg)] shadow-[var(--board-column-shadow)] transition-[background-color,border-color,box-shadow,transform] duration-300 ${
        isDropTarget
          ? "border-[var(--board-drop-border)] bg-[var(--board-drop-bg)] ring-2 ring-[var(--board-drop-ring)]"
          : ""
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
      <CardHeader className="px-3 pb-0 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold dark:text-slate-100">
            <span className={`h-2 w-2 rounded-full ${column.color}`} />
            <span className="truncate">{column.title}</span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
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

        <div className="mt-0 h-px w-full bg-slate-200 dark:bg-[#343434]" />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
        <ScrollArea
          className={
            scrollAreaClassName ??
            `
              h-[240px] w-full
              sm:h-[280px]
              lg:h-[340px]
              xl:h-[420px]
            `
          }
        >
          <div className={`space-y-2 pt-0 pr-2 pb-2 ${hasTodos ? "" : "h-full"}`}>
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
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
