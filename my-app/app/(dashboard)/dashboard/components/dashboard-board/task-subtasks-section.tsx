import * as React from "react"
import {
  Archive,
  CalendarIcon,
  ChevronDown,
  CornerDownLeft,
  Ellipsis,
  Filter,
  Pencil,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { getLocalDateString, getTrustedTodayDateString } from "@/lib/trusted-time"
import {
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { cn } from "@/lib/utils"
import { AssigneeCombobox } from "../../backlog/components/assignee-combobox"
import { StatusCombobox } from "../../backlog/components/status-combobox"
import { PriorityIcon } from "../priority-icon"
import type { TodoItem } from "../../types"
import { formatDeadline, getInitials } from "../../utils"
import type { CreateSubtaskInput } from "./types"

type TaskSubtasksSectionProps = {
  checklist: string
  subtasks: TodoItem[]
  currentUserId?: string | null
  canManageOtherProjectResources?: boolean
  creatorNamesById?: Record<string, string>
  isSubmittingSubtask?: boolean
  createSubtaskError?: string | null
  onCreateSubtaskInputChange?: () => void
  onAddSubtask: (input: CreateSubtaskInput) => void | Promise<void>
  onOpenSubtask: (subtask: TodoItem) => void
  onSubtaskStatusChange: (subtaskId: string, nextStatus: TodoItem["status"]) => void
  onSubtaskAssigneeChange: (subtaskId: string, assigneeId: string | null) => void
  onSubtaskPriorityChange: (subtaskId: string, priority: TodoItem["priority"]) => void
  onEditSubtaskTitle: (subtask: TodoItem, nextTitle: string) => void | Promise<void>
  onUpdateSubtask: (
    subtaskId: string,
    updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
  ) => void | Promise<void>
  onArchiveSubtask: (subtask: TodoItem) => void | Promise<void>
}

function normalizeDate(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function isPastDate(date: Date) {
  return getLocalDateString(date) < getTrustedTodayDateString()
}

function parseChecklistProgress(checklist: string, fallbackTotal: number) {
  const [completedRaw = "0", totalRaw = `${fallbackTotal}`] = (checklist || "0/0").split("/")
  const completed = Number.parseInt(completedRaw, 10)
  const total = Number.parseInt(totalRaw, 10)

  if (Number.isNaN(completed) || Number.isNaN(total) || total < 0) {
    return { completed: 0, total: fallbackTotal }
  }

  return { completed, total }
}

function normalizeSubtaskTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function SubtaskGlyph() {
  return (
    <span className="relative h-4 w-4 shrink-0 text-[var(--brand-primary-fixed)]">
      <span className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-[2px] border border-current" />
      <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-[2px] border border-current" />
      <span className="absolute left-[7px] top-[7px] h-px w-[6px] bg-current" />
      <span className="absolute left-[6px] top-[5px] h-[6px] w-px bg-current" />
    </span>
  )
}

const subtaskGridClass =
  "grid grid-cols-[minmax(0,1.2fr)_72px_68px_68px_84px_72px_108px_52px] items-center gap-x-2.5"

type SubtaskStatusFilter = "all" | TodoItem["status"]
type SubtaskAssigneeFilter = "all" | "me"

const activeAssigneeFilterItemClassName =
  "bg-[color:rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary-fixed)] data-[highlighted]:bg-[color:rgba(var(--brand-primary-rgb),0.12)] data-[highlighted]:text-[var(--brand-primary-fixed)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.22)] dark:text-[#9bc2e2] dark:data-[highlighted]:bg-[color:rgba(var(--brand-primary-rgb),0.28)] dark:data-[highlighted]:text-[#c3dbef]"
const activeStatusFilterItemClassName =
  "bg-slate-100 text-slate-900 data-[highlighted]:bg-slate-200 data-[highlighted]:text-slate-950 dark:bg-[#303030] dark:text-slate-100 dark:data-[highlighted]:bg-[#3a3a3a] dark:data-[highlighted]:text-white"

export function TaskSubtasksSection({
  checklist,
  subtasks,
  currentUserId = null,
  canManageOtherProjectResources = false,
  creatorNamesById = {},
  isSubmittingSubtask = false,
  createSubtaskError = null,
  onCreateSubtaskInputChange,
  onAddSubtask,
  onOpenSubtask,
  onSubtaskStatusChange,
  onSubtaskAssigneeChange,
  onSubtaskPriorityChange,
  onEditSubtaskTitle,
  onUpdateSubtask,
  onArchiveSubtask,
}: TaskSubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState("")
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")
  const [newSubtaskStartDate, setNewSubtaskStartDate] = React.useState<Date>()
  const [newSubtaskDueDate, setNewSubtaskDueDate] = React.useState<Date>()
  const [subtaskTitleError, setSubtaskTitleError] = React.useState<string | null>(null)
  const [openStartDateSubtaskId, setOpenStartDateSubtaskId] = React.useState<
    string | null
  >(null)
  const [openDueDateSubtaskId, setOpenDueDateSubtaskId] = React.useState<
    string | null
  >(null)
  const [statusFilter, setStatusFilter] = React.useState<SubtaskStatusFilter>("all")
  const [assigneeFilter, setAssigneeFilter] =
    React.useState<SubtaskAssigneeFilter>("all")
  const createSubtaskRowRef = React.useRef<HTMLDivElement | null>(null)
  const editSubtaskRowRef = React.useRef<HTMLDivElement | null>(null)
  const normalizedCurrentUserId = currentUserId?.trim() ?? ""

  const progress = React.useMemo(
    () => parseChecklistProgress(checklist, subtasks.length),
    [checklist, subtasks.length]
  )
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const activeFilterCount =
    (assigneeFilter === "me" ? 1 : 0) + (statusFilter === "all" ? 0 : 1)
  const hasActiveFilters = activeFilterCount > 0
  const visibleSubtasks = React.useMemo(() => {
    const filteredByAssignee =
      assigneeFilter === "me" && normalizedCurrentUserId
        ? subtasks.filter((subtask) => subtask.assigneeId === normalizedCurrentUserId)
        : subtasks

    return statusFilter === "all"
      ? filteredByAssignee
      : filteredByAssignee.filter((subtask) => subtask.status === statusFilter)
  }, [assigneeFilter, normalizedCurrentUserId, statusFilter, subtasks])
  const getDuplicateSubtaskTitleError = React.useCallback(
    (title: string, ignoredSubtaskId?: string) => {
      const normalizedTitle = normalizeSubtaskTitle(title)

      if (!normalizedTitle) {
        return null
      }

      const duplicate = subtasks.some(
        (subtask) =>
          subtask.id !== ignoredSubtaskId &&
          normalizeSubtaskTitle(subtask.title) === normalizedTitle
      )

      return duplicate ? `Subtask "${title.trim()}" already exists.` : null
    },
    [subtasks]
  )

  React.useEffect(() => {
    if (!isCreatingSubtask) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!createSubtaskRowRef.current?.contains(event.target as Node)) {
        setIsCreatingSubtask(false)
        setNewSubtaskTitle("")
        setNewSubtaskStartDate(undefined)
        setNewSubtaskDueDate(undefined)
        setSubtaskTitleError(null)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [isCreatingSubtask])

  React.useEffect(() => {
    if (!editingSubtaskId) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!editSubtaskRowRef.current?.contains(event.target as Node)) {
        setEditingSubtaskId(null)
        setEditingTitle("")
        setSubtaskTitleError(null)
        setOpenStartDateSubtaskId(null)
        setOpenDueDateSubtaskId(null)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [editingSubtaskId])

  const commitTitleEdit = React.useCallback(
    async (subtask: TodoItem) => {
      const nextTitle = editingTitle.trim()

      if (!nextTitle || nextTitle === subtask.title) {
        setEditingSubtaskId(null)
        setEditingTitle("")
        setSubtaskTitleError(null)
        return
      }

      const titleValidationError = validateDisplayName(nextTitle, "Subtask name", {
        maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
      })

      if (titleValidationError) {
        setSubtaskTitleError(titleValidationError)
        return
      }

      const duplicateError = getDuplicateSubtaskTitleError(nextTitle, subtask.id)

      if (duplicateError) {
        setSubtaskTitleError(duplicateError)
        return
      }

      try {
        await onEditSubtaskTitle(subtask, nextTitle)
        setSubtaskTitleError(null)
      } finally {
        setEditingSubtaskId(null)
        setEditingTitle("")
      }
    },
    [editingTitle, getDuplicateSubtaskTitleError, onEditSubtaskTitle]
  )

  const handleSubtaskStartDateChange = React.useCallback(
    async (subtask: TodoItem, nextDate?: Date) => {
      setOpenStartDateSubtaskId(null)

      const nextStartDate = nextDate ? nextDate.toISOString().slice(0, 10) : ""
      const currentDueDate = subtask.deadline || ""
      const nextDueDate =
        nextDate &&
        currentDueDate &&
        normalizeDate(new Date(currentDueDate)) < normalizeDate(nextDate)
          ? ""
          : currentDueDate

      try {
        await onUpdateSubtask(subtask.id, {
          title: subtask.title,
          description: subtask.description,
          startDate: nextStartDate,
          deadline: nextDueDate,
        })
      } finally {
        if (!nextDate) {
          setOpenDueDateSubtaskId(null)
        }
      }
    },
    [onUpdateSubtask]
  )

  const handleSubtaskDueDateChange = React.useCallback(
    async (subtask: TodoItem, nextDate?: Date) => {
      setOpenDueDateSubtaskId(null)

      await onUpdateSubtask(subtask.id, {
        title: subtask.title,
        description: subtask.description,
        startDate: subtask.startDate,
        deadline: nextDate ? nextDate.toISOString().slice(0, 10) : "",
      })
    },
    [onUpdateSubtask]
  )

  const commitNewSubtask = React.useCallback(async () => {
    if (isSubmittingSubtask) {
      return
    }

    const nextTitle = newSubtaskTitle.trim()

    if (!nextTitle) {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
      setNewSubtaskStartDate(undefined)
      setNewSubtaskDueDate(undefined)
      setSubtaskTitleError(null)
      return
    }

    const titleValidationError = validateDisplayName(nextTitle, "Subtask name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (titleValidationError) {
      setSubtaskTitleError(titleValidationError)
      return
    }

    const duplicateError = getDuplicateSubtaskTitleError(nextTitle)

    if (duplicateError) {
      setSubtaskTitleError(duplicateError)
      return
    }

    try {
      await onAddSubtask({
        title: nextTitle,
        description: "",
        startDate: newSubtaskStartDate
          ? newSubtaskStartDate.toISOString().slice(0, 10)
          : undefined,
        dueDate: newSubtaskDueDate
          ? newSubtaskDueDate.toISOString().slice(0, 10)
          : undefined,
      })
      setSubtaskTitleError(null)
    } finally {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
      setNewSubtaskStartDate(undefined)
      setNewSubtaskDueDate(undefined)
    }
  }, [getDuplicateSubtaskTitleError, isSubmittingSubtask, newSubtaskDueDate, newSubtaskStartDate, newSubtaskTitle, onAddSubtask])

  const toggleAssignToMeFilter = React.useCallback(() => {
    setAssigneeFilter((current) => (current === "me" ? "all" : "me"))
  }, [])

  const clearFilters = React.useCallback(() => {
    setAssigneeFilter("all")
    setStatusFilter("all")
  }, [])

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="mt-4 space-y-3"
    >
      <div className="space-y-3">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="space-y-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-left text-slate-900 transition hover:text-slate-700 dark:text-[#f1f2f4] dark:hover:text-white"
                aria-label={`${isExpanded ? "Collapse" : "Expand"} subtasks`}
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isExpanded ? "rotate-0" : "-rotate-90"
                  }`}
                />
                <span className="text-[15px] font-semibold">Subtasks</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#343434] dark:text-slate-300">
                  {subtasks.length}
                </span>
              </button>
            </CollapsibleTrigger>

            {isExpanded ? (
              <p className="pl-6 text-sm text-slate-500 dark:text-[#9fadbc]">
                Break this task into smaller steps and manage them here.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc] dark:hover:bg-[#24292f] dark:hover:text-[#dee4ea]"
                  aria-label="Filter subtasks"
                  title="Filter"
                >
                  <Filter className="h-4 w-4" />
                  {hasActiveFilters ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary-fixed)] px-1 text-[10px] font-semibold leading-none text-white dark:bg-[var(--brand-primary-fixed)]">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
              >
                <DropdownMenuItem
                  disabled={!normalizedCurrentUserId}
                  className={
                    assigneeFilter === "me"
                      ? activeAssigneeFilterItemClassName
                      : undefined
                  }
                  onSelect={toggleAssignToMeFilter}
                >
                  Assign to me
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                    <DropdownMenuItem
                      className={
                        statusFilter === "all"
                          ? activeStatusFilterItemClassName
                          : undefined
                      }
                      onSelect={() => setStatusFilter("all")}
                    >
                      All
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "gap-2",
                        statusFilter === "todo"
                          ? activeStatusFilterItemClassName
                          : undefined
                      )}
                      onSelect={() => setStatusFilter("todo")}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary-fixed)]" />
                      To do
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "gap-2",
                        statusFilter === "inprogress"
                          ? activeStatusFilterItemClassName
                          : undefined
                      )}
                      onSelect={() => setStatusFilter("inprogress")}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                      In progress
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "gap-2",
                        statusFilter === "revision"
                          ? activeStatusFilterItemClassName
                          : undefined
                      )}
                      onSelect={() => setStatusFilter("revision")}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                      Revision
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "gap-2",
                        statusFilter === "completed"
                          ? activeStatusFilterItemClassName
                          : undefined
                      )}
                      onSelect={() => setStatusFilter("completed")}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      Completed
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-[#9fadbc] dark:hover:text-[#dee4ea]"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] transition hover:opacity-90"
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
              aria-label="Add subtask"
              title="Add subtask"
              onClick={() => {
                setIsCreatingSubtask(true)
                setEditingSubtaskId(null)
                setEditingTitle("")
                setSubtaskTitleError(null)
                setNewSubtaskTitle("")
                setNewSubtaskStartDate(undefined)
                setNewSubtaskDueDate(undefined)
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-[#8c8f98]">
              <div
                className="h-full rounded-full bg-slate-500 transition-[width] dark:bg-[#c7cbd1]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="min-w-16 text-right text-sm text-slate-500 dark:text-[#9fadbc]">
              {completionPercent}% Done
            </p>
          </div>
        ) : null}
      </div>

      <CollapsibleContent>
        <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-sm dark:border-[#454f59] dark:bg-[#1d2125]">
          <div
            className={`${subtaskGridClass} border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-[#2b3138] dark:bg-[#1d2125] dark:text-[#9fadbc]`}
          >
            <span>Work</span>
            <span className="text-center">Created by</span>
            <span className="text-center">Start</span>
            <span className="text-center">Due</span>
            <span className="text-center">Assignee</span>
            <span className="text-center">Priority</span>
            <span className="text-center">Status</span>
            <span className="text-right">Action</span>
          </div>

          {subtasks.length === 0 ? (
            isCreatingSubtask ? null : (
              <div className="px-3 py-4 text-sm text-slate-500 dark:text-[#9fadbc]">
                No subtasks yet.
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-[#2b3138]">
              {visibleSubtasks.map((subtask) => {
                const isEditingCurrentSubtask = editingSubtaskId === subtask.id
                const canManageSubtask =
                  Boolean(normalizedCurrentUserId) &&
                  (
                    subtask.createdByUserId === normalizedCurrentUserId ||
                    canManageOtherProjectResources
                  )
                const canUpdateSubtaskFields = Boolean(normalizedCurrentUserId)
                const createdByName =
                  creatorNamesById[subtask.createdByUserId ?? ""] ??
                  subtask.createdByUserId ??
                  "Unknown user"

                return (
                  <div
                    key={subtask.id}
                    ref={isEditingCurrentSubtask ? editSubtaskRowRef : null}
                    role={isEditingCurrentSubtask ? undefined : "button"}
                    tabIndex={isEditingCurrentSubtask ? undefined : 0}
                    onClick={() => {
                      if (!isEditingCurrentSubtask) {
                        onOpenSubtask(subtask)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (isEditingCurrentSubtask) {
                        return
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onOpenSubtask(subtask)
                      }
                    }}
                    className={`${subtaskGridClass} group bg-white px-3 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary-fixed)] focus-visible:ring-inset dark:bg-[#1f1f23] dark:hover:bg-[#24292f] ${
                      isEditingCurrentSubtask ? "" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isEditingCurrentSubtask ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <SubtaskGlyph />
                          <Input
                            value={editingTitle}
                            onChange={(event) => {
                              setEditingTitle(event.target.value)
                              setSubtaskTitleError(null)
                            }}
                            maxLength={TASK_SPRINT_NAME_MAX_LENGTH}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                void commitTitleEdit(subtask)
                              }

                              if (event.key === "Escape") {
                                setEditingSubtaskId(null)
                                setEditingTitle("")
                                setSubtaskTitleError(null)
                              }
                            }}
                            autoFocus
                            className="h-8 border-[color:rgba(var(--brand-primary-rgb),0.28)] bg-white text-[13px] text-slate-900 shadow-none dark:border-[color:rgba(var(--brand-primary-rgb),0.45)] dark:bg-[#1d2125] dark:text-[#dee4ea]"
                          />
                          <span className="shrink-0 text-xs text-slate-500 dark:text-[#9fadbc]">
                            {editingTitle.length}/{TASK_SPRINT_NAME_MAX_LENGTH}
                          </span>
                          {subtaskTitleError ? (
                            <p className="min-w-36 text-xs text-red-500">
                              {subtaskTitleError}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            disabled={!canManageSubtask}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Save subtask title"
                            title="Save"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void commitTitleEdit(subtask)}
                          >
                            <CornerDownLeft className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="flex min-w-0 items-center gap-2 overflow-hidden rounded-[2px] text-left text-[13px] text-slate-900 transition group-hover:text-[var(--brand-primary-fixed)] dark:text-[#dee4ea] dark:group-hover:text-[#9bc2e2]"
                          title={`Open ${subtask.title}`}
                        >
                          <SubtaskGlyph />
                          <span className="min-w-0 truncate">
                            {subtask.title}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar size="sm">
                              <AvatarFallback className="text-xs font-bold">
                                {getInitials(createdByName)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            {createdByName}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div
                      className="flex justify-center"
                      onClick={(event) => {
                        if (!subtask.startDate || isEditingCurrentSubtask) {
                          event.stopPropagation()
                        }
                      }}
                    >
                      {subtask.startDate && !isEditingCurrentSubtask ? (
                        <span className="text-[11px] text-slate-600 dark:text-[#dee4ea]">
                          {formatDeadline(subtask.startDate)}
                        </span>
                      ) : (
                        <Popover
                          open={openStartDateSubtaskId === subtask.id}
                          onOpenChange={(nextOpen) =>
                            setOpenStartDateSubtaskId(nextOpen ? subtask.id : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!canUpdateSubtaskFields}
                              className={cn(
                                "h-7 w-7 rounded-[2px] border-slate-200 bg-white p-0 text-slate-500 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc]",
                                subtask.startDate
                                  ? "border-[color:rgba(var(--brand-primary-rgb),0.28)] text-[var(--brand-primary-fixed)] dark:border-[color:rgba(var(--brand-primary-rgb),0.45)] dark:text-[#9bc2e2]"
                                  : ""
                              )}
                              aria-label={
                                subtask.startDate
                                  ? `Start date ${formatDeadline(subtask.startDate)}`
                                  : `Set start date for ${subtask.title}`
                              }
                              title={
                                subtask.startDate
                                  ? `Start date: ${formatDeadline(subtask.startDate)}`
                                  : "Set start date"
                              }
                            >
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto border-slate-200 bg-white p-0 dark:border-[#454f59] dark:bg-[#1d2125]"
                            align="center"
                          >
                            <Calendar
                              mode="single"
                              selected={
                                subtask.startDate ? new Date(subtask.startDate) : undefined
                              }
                              onSelect={(date) => void handleSubtaskStartDateChange(subtask, date)}
                              disabled={(date) => !canUpdateSubtaskFields || isPastDate(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div
                      className="flex justify-center"
                      onClick={(event) => {
                        if (!subtask.deadline || isEditingCurrentSubtask) {
                          event.stopPropagation()
                        }
                      }}
                    >
                      {subtask.deadline && !isEditingCurrentSubtask ? (
                        <span className="text-[11px] text-slate-600 dark:text-[#dee4ea]">
                          {formatDeadline(subtask.deadline)}
                        </span>
                      ) : (
                        <Popover
                          open={openDueDateSubtaskId === subtask.id}
                          onOpenChange={(nextOpen) =>
                            setOpenDueDateSubtaskId(nextOpen ? subtask.id : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!subtask.startDate || !canUpdateSubtaskFields}
                              className={cn(
                                "h-7 w-7 rounded-[2px] border-slate-200 bg-white p-0 text-slate-500 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc]",
                                subtask.deadline
                                  ? "border-[color:rgba(var(--brand-primary-rgb),0.28)] text-[var(--brand-primary-fixed)] dark:border-[color:rgba(var(--brand-primary-rgb),0.45)] dark:text-[#9bc2e2]"
                                  : ""
                              )}
                              aria-label={
                                subtask.deadline
                                  ? `Due date ${formatDeadline(subtask.deadline)}`
                                  : subtask.startDate
                                  ? `Set due date for ${subtask.title}`
                                  : `Set start date first for ${subtask.title}`
                              }
                              title={
                                subtask.deadline
                                  ? `Due date: ${formatDeadline(subtask.deadline)}`
                                  : subtask.startDate
                                  ? "Set due date"
                                  : "Set start date first"
                              }
                            >
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto border-slate-200 bg-white p-0 dark:border-[#454f59] dark:bg-[#1d2125]"
                            align="center"
                          >
                            <Calendar
                              mode="single"
                              selected={subtask.deadline ? new Date(subtask.deadline) : undefined}
                              onSelect={(date) => void handleSubtaskDueDateChange(subtask, date)}
                              disabled={(date) =>
                                !canUpdateSubtaskFields ||
                                (subtask.startDate
                                  ? normalizeDate(date) < normalizeDate(new Date(subtask.startDate))
                                  : false)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div
                      className="flex justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <AssigneeCombobox
                        value={subtask.assigneeId}
                        disabled={!canUpdateSubtaskFields}
                        onChange={(assigneeId) =>
                          onSubtaskAssigneeChange(subtask.id, assigneeId)
                        }
                        className="h-5.5 w-5.5 rounded-full border-slate-200 bg-transparent p-0 hover:bg-slate-100 dark:border-[#4c525a] dark:bg-[#3b3f45] dark:hover:bg-[#4a4f57]"
                        avatarClassName="h-5.5 w-5.5"
                        fallbackClassName="bg-[var(--brand-primary-fixed)] text-xs font-bold text-white dark:bg-[#3b3f45] dark:text-white"
                        unassignedIconClassName="text-slate-500 dark:text-[#dee4ea]"
                        contentClassName="dark:border-[#454f59] dark:bg-[#1d2125]"
                      />
                    </div>

                    <div
                      className="flex justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={!canUpdateSubtaskFields}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#dee4ea] dark:hover:bg-[#24292f]"
                            aria-label={`Priority ${subtask.priority}`}
                            title={`Priority: ${subtask.priority}`}
                          >
                            <PriorityIcon
                              priority={subtask.priority}
                              className={
                                subtask.priority === "High"
                                  ? "h-3.5 w-3.5 text-red-500"
                                  : subtask.priority === "Low"
                                  ? "h-3.5 w-3.5 text-[var(--brand-primary-fixed)]"
                                  : "h-3.5 w-3.5 text-orange-500"
                              }
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="center"
                          className="w-36 rounded-[6px] border-slate-200 bg-white p-1 shadow-md dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                        >
                          {(["Low", "Medium", "High"] as const).map((priority) => (
                            <DropdownMenuItem
                              key={priority}
                              className={cn(
                                "rounded-[4px] text-sm",
                                subtask.priority === priority &&
                                  "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                              )}
                              onSelect={() => onSubtaskPriorityChange(subtask.id, priority)}
                            >
                              <PriorityIcon priority={priority} />
                              {priority}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div
                      className="flex justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <StatusCombobox
                        value={subtask.status}
                        disabled={!canUpdateSubtaskFields}
                        onChange={(nextStatus) =>
                          onSubtaskStatusChange(
                            subtask.id,
                            nextStatus as TodoItem["status"]
                          )
                        }
                        className="h-5.5 min-w-[80px] rounded-[2px] px-1.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                        contentClassName="dark:border-[#454f59] dark:bg-[#1d2125]"
                      />
                    </div>

                    <div
                      className="flex items-center justify-end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-[#9fadbc] dark:hover:bg-[#2c333a] dark:hover:text-[#dee4ea]"
                            aria-label={`Open actions for ${subtask.title}`}
                            title="Actions"
                          >
                            <Ellipsis className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-36 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                        >
                          <DropdownMenuItem
                            disabled={!canManageSubtask}
                            onSelect={() => {
                              setEditingSubtaskId(subtask.id)
                              setEditingTitle(subtask.title)
                              setSubtaskTitleError(null)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canManageSubtask}
                            onSelect={() => void onArchiveSubtask(subtask)}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {isCreatingSubtask ? (
            <div
              ref={createSubtaskRowRef}
              className={`${subtaskGridClass} border-t border-slate-200 bg-white px-3 py-2 dark:border-[#2b3138] dark:bg-[#1f1f23]`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <SubtaskGlyph />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(event) => {
                      setNewSubtaskTitle(event.target.value)
                      setSubtaskTitleError(null)
                      onCreateSubtaskInputChange?.()
                    }}
                    maxLength={TASK_SPRINT_NAME_MAX_LENGTH}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void commitNewSubtask()
                      }

                      if (event.key === "Escape") {
                        setIsCreatingSubtask(false)
                        setNewSubtaskTitle("")
                        setNewSubtaskStartDate(undefined)
                        setNewSubtaskDueDate(undefined)
                        setSubtaskTitleError(null)
                      }
                    }}
                    autoFocus
                    placeholder="Create subtask title"
                    className="h-8 w-full min-w-0 border-[color:rgba(var(--brand-primary-rgb),0.28)] bg-white text-[13px] text-slate-900 shadow-none dark:border-[color:rgba(var(--brand-primary-rgb),0.45)] dark:bg-[#1d2125] dark:text-[#dee4ea]"
                  />
                  <span className="shrink-0 text-xs text-slate-500 dark:text-[#9fadbc]">
                    {newSubtaskTitle.length}/{TASK_SPRINT_NAME_MAX_LENGTH}
                  </span>
                  {createSubtaskError ? (
                    <p className="text-xs text-red-500">{createSubtaskError}</p>
                  ) : subtaskTitleError ? (
                    <p className="text-xs text-red-500">{subtaskTitleError}</p>
                  ) : null}
                </div>
              </div>

              <div className="h-9" />

              <div />

              <div />

              <div className="h-9" />
              <div className="h-9" />
              <div className="h-9" />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90"
                  aria-label="Create subtask"
                  title={isSubmittingSubtask ? "Creating subtask" : "Create"}
                  disabled={isSubmittingSubtask}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void commitNewSubtask()}
                >
                  {isSubmittingSubtask ? (
                    <span className="text-[10px] font-semibold">...</span>
                  ) : (
                    <CornerDownLeft className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
