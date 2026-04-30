import * as React from "react"
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd"

import {
  Archive,
  CalendarDays,
  MessageCirclePlus,
  PencilLine,
  FolderKanban,
  GitFork,
  MessageSquareMore,
  MoreHorizontal,
  Trash2,
  UserRound,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { AssigneeCombobox } from "../backlog/components/assignee-combobox"
import { assigneeOptions } from "../backlog/types"
import { columns } from "../constants"
import type { TodoItem } from "../types"
import { formatDeadline } from "../utils"

type DashboardTaskCardProps = {
  todo: TodoItem
  parentTaskTitle?: string | null
  isDragging?: boolean
  sprints: Array<{
    id: string
    name: string
    backlogItemIds: string[]
  }>
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onAssigneeChange: (todoId: string, assigneeId: string | null) => void
  onAddToSprint: (todoId: string, sprintId: string) => Promise<void> | void
  onOpen: (todo: TodoItem, target?: "default" | "comments") => void
  draggableProvided?: DraggableProvided
  dragSnapshot?: DraggableStateSnapshot
}

export function DashboardTaskCard({
  todo,
  parentTaskTitle,
  isDragging = false,
  sprints,
  onStatusChange,
  onAssigneeChange,
  onAddToSprint,
  onOpen,
  draggableProvided,
  dragSnapshot,
}: DashboardTaskCardProps) {
  const [completedSubtasksRaw = "0", totalSubtasksRaw = "0"] = todo.checklist.split("/")
  const completedSubtasks = Number.parseInt(completedSubtasksRaw, 10) || 0
  const subtaskCount = Number.parseInt(totalSubtasksRaw, 10) || 0
  const remainingSubtasks = Math.max(subtaskCount - completedSubtasks, 0)
  const isSubtask = Boolean(todo.parentId)
  const subtaskTooltipLabel =
    remainingSubtasks === 1
      ? "1 child task remaining"
      : `${remainingSubtasks} child tasks remaining`

  return (
    <div className="relative pt-1">
      <div
        ref={draggableProvided?.innerRef}
        {...draggableProvided?.draggableProps}
        {...draggableProvided?.dragHandleProps}
        role="button"
        tabIndex={0}
        className={`w-full border border-[var(--board-task-border)] bg-[var(--board-task-bg)] p-2 text-left shadow-[var(--board-task-shadow)] transition-[background-color,border-color,box-shadow] duration-300 hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-[var(--board-task-shadow-hover)] focus:outline-none focus:ring-2 focus:ring-slate-300 dark:hover:border-sky-700/70 dark:hover:bg-sky-950/20 dark:focus:ring-[#4a4a4a] ${
          isSubtask
            ? "cursor-grab border-l-2 border-l-sky-400 active:cursor-grabbing"
            : "cursor-grab active:cursor-grabbing"
        } ${
          isDragging || dragSnapshot?.isDragging
            ? "ring-2 ring-sky-300 dark:ring-sky-700"
            : ""
        }`}
        style={draggableProvided?.draggableProps.style}
        onClick={() => onOpen(todo)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpen(todo)
          }
        }}
      >
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {isSubtask ? <GitFork className="h-3.5 w-3.5" /> : <FolderKanban className="h-3.5 w-3.5" />}
        <span title={isSubtask ? "Child task" : "Parent task"}>{todo.displayId}</span>
      </div>

      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-slate-900 dark:text-slate-100">
          {todo.title}
        </h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 rounded-sm p-1 text-slate-400 transition-[background-color,color] duration-200 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:hover:bg-[#303030] dark:hover:text-slate-200"
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
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={Boolean(todo.parentId)}>
                <FolderKanban className="h-4 w-4" />
                Add to Sprint
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                {sprints.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No sprints yet
                  </DropdownMenuItem>
                ) : (
                  sprints.map((sprint) => (
                    <DropdownMenuItem
                      key={sprint.id}
                      className={
                        sprint.backlogItemIds.includes(todo.id)
                          ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                          : undefined
                      }
                      onSelect={() => void onAddToSprint(todo.id, sprint.id)}
                    >
                      {sprint.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PencilLine className="h-4 w-4" />
                Change status
              </DropdownMenuSubTrigger>
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
              <DropdownMenuSubTrigger>
                <UserRound className="h-4 w-4" />
                Assignee
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                <DropdownMenuItem
                  className={
                    !todo.assigneeId
                      ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                      : undefined
                  }
                  onSelect={() => onAssigneeChange(todo.id, null)}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-[#4a4a4a] dark:bg-[#262626]">
                    <UserRound className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                  </span>
                  <span className="flex-1">Unassigned</span>
                </DropdownMenuItem>
                {assigneeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    className={
                      todo.assigneeId === option.id
                        ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                        : undefined
                    }
                    onSelect={() => onAssigneeChange(todo.id, option.id)}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[9px]">
                        {option.initials ?? "A"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{option.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>
              <MessageCirclePlus className="h-4 w-4" />
              Add Comment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Archive className="h-4 w-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/30 dark:focus:text-red-400">
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <CalendarDays className="h-3 w-3" />
        <span>{formatDeadline(todo.deadline)}</span>
      </div>

      <div className="my-1.5 h-px bg-slate-200 dark:bg-[#3a3a3a]" />

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm transition-colors duration-200 hover:text-slate-700 dark:hover:text-slate-200"
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
                <div className="flex cursor-default items-center gap-1 rounded-sm transition-colors duration-200 hover:text-slate-700 dark:hover:text-slate-200">
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
          className="h-5 w-5 rounded-full border-slate-200 bg-transparent p-0 transition-[background-color,border-color,transform] duration-200 hover:scale-105 hover:bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#262626] dark:hover:bg-[#303030]"
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
