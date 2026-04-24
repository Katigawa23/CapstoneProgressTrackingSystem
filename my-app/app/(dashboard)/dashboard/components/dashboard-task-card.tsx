import * as React from "react"

import {
  CalendarDays,
  FolderKanban,
  GitFork,
  MessageSquareMore,
  MoreHorizontal,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { AssigneeCombobox } from "../backlog/components/assignee-combobox"
import { columns } from "../constants"
import type { TodoItem } from "../types"
import { formatDeadline } from "../utils"

type Person = {
  name: string
  src: string
}

type DashboardTaskCardProps = {
  todo: TodoItem
  people: Person[]
  parentTaskTitle?: string | null
  isDragging?: boolean
  showDropLine?: boolean
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onDragStart?: (todoId: string) => void
  onDragEnd?: () => void
  onDragEnterCard?: (todoId: string) => void
  onDropOnCard?: (todoId: string) => void
  onOpen: (todo: TodoItem, target?: "default" | "comments") => void
}

export function DashboardTaskCard({
  todo,
  parentTaskTitle,
  isDragging = false,
  showDropLine = false,
  onStatusChange,
  onAssigneeChange,
  onDragStart,
  onDragEnd,
  onDragEnterCard,
  onDropOnCard,
  onOpen,
}: DashboardTaskCardProps) {
  const [completedSubtasksRaw = "0", totalSubtasksRaw = "0"] = todo.checklist.split("/")
  const completedSubtasks = Number.parseInt(completedSubtasksRaw, 10) || 0
  const subtaskCount = Number.parseInt(totalSubtasksRaw, 10) || 0
  const remainingSubtasks = Math.max(subtaskCount - completedSubtasks, 0)
  const wasDraggedRef = React.useRef(false)
  const isSubtask = Boolean(todo.parentId)
  const subtaskTooltipLabel =
    remainingSubtasks === 1
      ? "1 child task remaining"
      : `${remainingSubtasks} child tasks remaining`

  return (
    <div className="relative">
      <div
        className={`pointer-events-none absolute -top-1 left-0 right-0 z-10 transition-opacity ${
          showDropLine ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="relative h-0.5 rounded-full bg-sky-500 dark:bg-sky-400">
          <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-sky-500 bg-white dark:border-sky-400 dark:bg-[#1f1f1f]" />
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        draggable="true"
        className={`w-full border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-[#343434] dark:bg-[#262626] dark:focus:ring-[#4a4a4a] ${
          isSubtask
            ? "cursor-grab border-l-2 border-l-sky-400 active:cursor-grabbing"
            : "cursor-grab active:cursor-grabbing"
        } ${
          isDragging ? "opacity-50 ring-2 ring-sky-300 dark:ring-sky-700" : ""
        }`}
        onClick={() => {
          if (wasDraggedRef.current) {
            wasDraggedRef.current = false
            return
          }

          onOpen(todo)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpen(todo)
          }
        }}
        onDragStart={(event) => {
          wasDraggedRef.current = true
          event.dataTransfer.effectAllowed = "move"
          event.dataTransfer.setData("text/plain", todo.id)
          onDragStart?.(todo.id)
        }}
        onDragEnd={() => {
          window.setTimeout(() => {
            wasDraggedRef.current = false
          }, 0)
          onDragEnd?.()
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragEnter={() => {
          onDragEnterCard?.(todo.id)
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDropOnCard?.(todo.id)
        }}
      >
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {isSubtask ? <GitFork className="h-3.5 w-3.5" /> : <FolderKanban className="h-3.5 w-3.5" />}
        <span title={isSubtask ? "Child task" : "Parent task"}>{todo.displayId}</span>
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-slate-900 dark:text-slate-100">
          {todo.title}
        </h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 rounded-sm p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:hover:bg-[#303030] dark:hover:text-slate-200"
              type="button"
              aria-label={`Open actions for ${todo.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem>Submit</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                {columns.map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    className={
                      column.id === todo.status
                        ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                        : undefined
                    }
                    onSelect={() => onStatusChange(todo.id, column.id)}
                  >
                    {column.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assignee</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                <DropdownMenuItem>unassign</DropdownMenuItem>
                <DropdownMenuItem>kerby@gmail.com</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>Add Comment</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Archive</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/30 dark:focus:text-red-400">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <CalendarDays className="h-3 w-3" />
        <span>{formatDeadline(todo.deadline)}</span>
      </div>

      <div className="my-2 h-px bg-slate-200 dark:bg-[#3a3a3a]" />

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm transition hover:text-slate-700 dark:hover:text-slate-200"
            aria-label={`Open comments for ${todo.title}`}
            onClick={(event) => {
              event.stopPropagation()
              onOpen(todo, "comments")
            }}
          >
            <MessageSquareMore className="h-3 w-3" />
            <span>{todo.comments}</span>
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-default items-center gap-1 rounded-sm transition hover:text-slate-700 dark:hover:text-slate-200">
                  <GitFork className="h-3 w-3" />
                  <span>{isSubtask ? "Child task" : subtaskCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {isSubtask
                  ? `Child task of ${parentTaskTitle?.trim() || "parent task"}`
                  : subtaskTooltipLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <AssigneeCombobox
          value={todo.assigneeId}
          onChange={(assigneeId) => onAssigneeChange(todo.id, assigneeId)}
          className="h-5 w-5 rounded-full border-slate-200 bg-transparent p-0 transition hover:scale-105 hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#262626] dark:hover:bg-[#303030]"
          avatarClassName="h-5 w-5"
          fallbackClassName="text-[8px]"
          unassignedIconClassName="h-3 w-3 text-slate-500 dark:text-slate-300"
          contentClassName="dark:border-[#343434] dark:bg-[#262626]"
        />
      </div>
      </div>
    </div>
  )
}
