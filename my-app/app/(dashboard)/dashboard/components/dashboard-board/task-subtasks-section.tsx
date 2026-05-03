import * as React from "react"
import { format } from "date-fns"

import {
  CalendarIcon,
  ChevronDown,
  CornerDownLeft,
  Ellipsis,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { cn } from "@/lib/utils"
import { readClientAuthSession } from "@/lib/auth-client"
import { AssigneeCombobox } from "../../backlog/components/assignee-combobox"
import { StatusCombobox } from "../../backlog/components/status-combobox"
import type { TodoItem } from "../../types"
import { formatDeadline } from "../../utils"
import type { CreateSubtaskInput } from "./types"

type TaskSubtasksSectionProps = {
  checklist: string
  subtasks: TodoItem[]
  onAddSubtask: (input: CreateSubtaskInput) => void | Promise<void>
  onOpenSubtask: (subtask: TodoItem) => void
  onSubtaskStatusChange: (subtaskId: string, nextStatus: TodoItem["status"]) => void
  onSubtaskAssigneeChange: (subtaskId: string, assigneeId: string | null) => void
  onEditSubtaskTitle: (subtask: TodoItem, nextTitle: string) => void | Promise<void>
  onUpdateSubtask: (
    subtaskId: string,
    updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
  ) => void | Promise<void>
  onDeleteSubtask: (subtask: TodoItem) => void | Promise<void>
}

function normalizeDate(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function isPastDate(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return normalizeDate(date) < today
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

function SubtaskGlyph() {
  return (
    <span className="relative h-4 w-4 shrink-0 text-blue-400">
      <span className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-[2px] border border-current" />
      <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-[2px] border border-current" />
      <span className="absolute left-[7px] top-[7px] h-px w-[6px] bg-current" />
      <span className="absolute left-[6px] top-[5px] h-[6px] w-px bg-current" />
    </span>
  )
}

const subtaskGridClass =
  "grid grid-cols-[minmax(0,1.2fr)_68px_68px_84px_108px_52px] items-center gap-x-2.5"

type SubtaskSortMode =
  | "default"
  | "title-asc"
  | "title-desc"
  | "created-oldest"
  | "created-newest"

type SubtaskStatusFilter = "all" | TodoItem["status"]

export function TaskSubtasksSection({
  checklist,
  subtasks,
  onAddSubtask,
  onOpenSubtask,
  onSubtaskStatusChange,
  onSubtaskAssigneeChange,
  onEditSubtaskTitle,
  onUpdateSubtask,
  onDeleteSubtask,
}: TaskSubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState("")
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")
  const [newSubtaskStartDate, setNewSubtaskStartDate] = React.useState<Date>()
  const [newSubtaskDueDate, setNewSubtaskDueDate] = React.useState<Date>()
  const [isStartDateOpen, setIsStartDateOpen] = React.useState(false)
  const [isDueDateOpen, setIsDueDateOpen] = React.useState(false)
  const [openStartDateSubtaskId, setOpenStartDateSubtaskId] = React.useState<
    string | null
  >(null)
  const [openDueDateSubtaskId, setOpenDueDateSubtaskId] = React.useState<
    string | null
  >(null)
  const [sortMode, setSortMode] = React.useState<SubtaskSortMode>("default")
  const [statusFilter, setStatusFilter] = React.useState<SubtaskStatusFilter>("all")
  const createSubtaskRowRef = React.useRef<HTMLDivElement | null>(null)
  const editSubtaskRowRef = React.useRef<HTMLDivElement | null>(null)
  const currentUserId = React.useMemo(
    () => readClientAuthSession()?.user?.id?.trim() ?? null,
    []
  )

  const progress = React.useMemo(
    () => parseChecklistProgress(checklist, subtasks.length),
    [checklist, subtasks.length]
  )
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const visibleSubtasks = React.useMemo(() => {
    const filteredSubtasks =
      statusFilter === "all"
        ? subtasks
        : subtasks.filter((subtask) => subtask.status === statusFilter)
    const nextSubtasks = [...filteredSubtasks]

    switch (sortMode) {
      case "title-asc":
        return nextSubtasks.sort((left, right) =>
          left.title.localeCompare(right.title)
        )
      case "title-desc":
        return nextSubtasks.sort((left, right) =>
          right.title.localeCompare(left.title)
        )
      case "created-oldest":
        return nextSubtasks.sort((left, right) => left.orderIndex - right.orderIndex)
      case "created-newest":
        return nextSubtasks.sort((left, right) => right.orderIndex - left.orderIndex)
      default:
        return nextSubtasks
    }
  }, [sortMode, statusFilter, subtasks])

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
        setIsStartDateOpen(false)
        setIsDueDateOpen(false)
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
        return
      }

      try {
        await onEditSubtaskTitle(subtask, nextTitle)
      } finally {
        setEditingSubtaskId(null)
        setEditingTitle("")
      }
    },
    [editingTitle, onEditSubtaskTitle]
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
    const nextTitle = newSubtaskTitle.trim()

    if (!nextTitle) {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
      setNewSubtaskStartDate(undefined)
      setNewSubtaskDueDate(undefined)
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
    } finally {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
      setNewSubtaskStartDate(undefined)
      setNewSubtaskDueDate(undefined)
      setIsStartDateOpen(false)
      setIsDueDateOpen(false)
    }
  }, [newSubtaskDueDate, newSubtaskStartDate, newSubtaskTitle, onAddSubtask])

  const handleAssignAllToMe = React.useCallback(() => {
    if (!currentUserId) {
      return
    }

    for (const subtask of subtasks) {
      onSubtaskAssigneeChange(subtask.id, currentUserId)
    }
  }, [currentUserId, onSubtaskAssigneeChange, subtasks])

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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc] dark:hover:bg-[#24292f] dark:hover:text-[#dee4ea]"
                  aria-label="More subtask actions"
                  title="More"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Sort</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                    <DropdownMenuItem
                      disabled={!currentUserId || subtasks.length === 0}
                      onSelect={handleAssignAllToMe}
                    >
                      Assign to me
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                        <DropdownMenuItem onSelect={() => setStatusFilter("all")}>
                          All
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("todo")}>
                          To do
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("inprogress")}>
                          In progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("revision")}>
                          Revision
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusFilter("completed")}>
                          Completed
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Date created</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                        <DropdownMenuItem onSelect={() => setSortMode("created-oldest")}>
                          Oldest to newest
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSortMode("created-newest")}>
                          Newest to oldest
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSortMode("default")}>
                          Default order
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

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
            <span className="text-center">Start</span>
            <span className="text-center">Due</span>
            <span className="text-center">Assignee</span>
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

                return (
                  <div
                    key={subtask.id}
                    ref={isEditingCurrentSubtask ? editSubtaskRowRef : null}
                    className={`${subtaskGridClass} bg-white px-3 py-2 transition-colors hover:bg-slate-50 dark:bg-[#1f1f23] dark:hover:bg-[#24292f]`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <SubtaskGlyph />
                      {isEditingCurrentSubtask ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <Input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                void commitTitleEdit(subtask)
                              }

                              if (event.key === "Escape") {
                                setEditingSubtaskId(null)
                                setEditingTitle("")
                              }
                            }}
                            autoFocus
                            className="h-8 border-blue-300 bg-white text-[13px] text-slate-900 shadow-none dark:border-blue-500/60 dark:bg-[#1d2125] dark:text-[#dee4ea]"
                          />
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90"
                            aria-label="Save subtask title"
                            title="Save"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void commitTitleEdit(subtask)}
                          >
                            <CornerDownLeft className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="truncate text-left text-[13px] text-slate-900 transition hover:text-blue-600 dark:text-[#dee4ea] dark:hover:text-[#8ab4ff]"
                          onClick={() => onOpenSubtask(subtask)}
                          title={`Open ${subtask.title}`}
                        >
                          {subtask.title}
                        </button>
                      )}
                    </div>

                    <div className="flex justify-center">
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
                              className={cn(
                                "h-7 w-7 rounded-[2px] border-slate-200 bg-white p-0 text-slate-500 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc]",
                                subtask.startDate
                                  ? "border-blue-300 text-blue-600 dark:border-blue-500/60 dark:text-blue-300"
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
                              disabled={isPastDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div className="flex justify-center">
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
                              disabled={!subtask.startDate}
                              className={cn(
                                "h-7 w-7 rounded-[2px] border-slate-200 bg-white p-0 text-slate-500 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc]",
                                subtask.deadline
                                  ? "border-blue-300 text-blue-600 dark:border-blue-500/60 dark:text-blue-300"
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
                                subtask.startDate
                                  ? normalizeDate(date) < normalizeDate(new Date(subtask.startDate))
                                  : false
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <AssigneeCombobox
                        value={subtask.assigneeId}
                        onChange={(assigneeId) =>
                          onSubtaskAssigneeChange(subtask.id, assigneeId)
                        }
                        className="h-5.5 w-5.5 rounded-full border-slate-200 bg-transparent p-0 hover:bg-slate-100 dark:border-[#4c525a] dark:bg-[#3b3f45] dark:hover:bg-[#4a4f57]"
                        avatarClassName="h-5.5 w-5.5"
                        fallbackClassName="bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-[#3b3f45] dark:text-[#dee4ea]"
                        unassignedIconClassName="text-slate-500 dark:text-[#dee4ea]"
                        contentClassName="dark:border-[#454f59] dark:bg-[#1d2125]"
                      />
                    </div>

                    <div className="flex justify-center">
                      <StatusCombobox
                        value={subtask.status}
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

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-[#9fadbc] dark:hover:bg-[#2c333a] dark:hover:text-[#dee4ea]"
                        aria-label={`Edit ${subtask.title}`}
                        title="Edit"
                        onClick={() => {
                          setEditingSubtaskId(subtask.id)
                          setEditingTitle(subtask.title)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-[#9fadbc] dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        aria-label={`Delete ${subtask.title}`}
                        title="Delete"
                        onClick={() => void onDeleteSubtask(subtask)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                    onChange={(event) => setNewSubtaskTitle(event.target.value)}
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
                        setIsStartDateOpen(false)
                        setIsDueDateOpen(false)
                      }
                    }}
                    autoFocus
                    placeholder="Create subtask title"
                    className="h-8 w-full min-w-0 border-blue-300 bg-white text-[13px] text-slate-900 shadow-none dark:border-blue-500/60 dark:bg-[#1d2125] dark:text-[#dee4ea]"
                  />
                </div>
              </div>

              <div />

              <div />

              <div className="h-9" />
              <div className="h-9" />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90"
                  aria-label="Create subtask"
                  title="Create"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void commitNewSubtask()}
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
