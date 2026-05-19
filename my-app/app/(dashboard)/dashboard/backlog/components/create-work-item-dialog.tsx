"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronDown, UserRound } from "lucide-react"

import { getLocalDateString, getTrustedTodayDateString } from "@/lib/trusted-time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TASK_SPRINT_NAME_MAX_LENGTH } from "@/lib/text-validation"
import { PriorityIcon } from "../../components/priority-icon"
import { assigneeOptions, getAssigneeOption } from "../types"

const TASK_DESCRIPTION_MAX_LENGTH = 255

type CreateWorkItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  startDate?: Date
  dueDate?: Date
  description: string
  assigneeId?: string | null
  priority?: "Low" | "Medium" | "High"
  titleError?: string | null
  onTitleChange: (value: string) => void
  onStartDateChange: (value: Date | undefined) => void
  onDueDateChange: (value: Date | undefined) => void
  onDescriptionChange: (value: string) => void
  onAssigneeChange?: (value: string | null) => void
  onPriorityChange?: (value: "Low" | "Medium" | "High") => void
  isSubmitting?: boolean
  onAddItem: () => void
  mode?: "task" | "subtask"
}

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  title,
  startDate,
  dueDate,
  description,
  assigneeId = null,
  priority = "Medium",
  titleError = null,
  onTitleChange,
  onStartDateChange,
  onDueDateChange,
  onDescriptionChange,
  onAssigneeChange,
  onPriorityChange,
  isSubmitting = false,
  onAddItem,
  mode = "task",
}: CreateWorkItemDialogProps) {
  const [startDateOpen, setStartDateOpen] = React.useState(false)
  const [dueDateOpen, setDueDateOpen] = React.useState(false)

  const normalizeDate = (date: Date) => {
    const nextDate = new Date(date)
    nextDate.setHours(0, 0, 0, 0)
    return nextDate
  }

  const isPastDate = (date: Date) => {
    return getLocalDateString(date) < getTrustedTodayDateString()
  }

  const isBeforeStartDate = (date: Date) => {
    if (!startDate) {
      return false
    }

    return normalizeDate(date) < normalizeDate(startDate)
  }

  const isBeforeDate = (date: Date, minimumDate: Date) => {
    return normalizeDate(date) < normalizeDate(minimumDate)
  }

  React.useEffect(() => {
    if (!open) {
      setStartDateOpen(false)
      setDueDateOpen(false)
    }
  }, [open])

  const isSubtaskMode = mode === "subtask"
  const selectedAssignee = getAssigneeOption(assigneeId)
  const normalizedDescription = description.slice(0, TASK_DESCRIPTION_MAX_LENGTH)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-[2px] border-slate-200 bg-white px-5 py-4 text-slate-900 dark:border-[#343434] dark:bg-[#171717] dark:text-slate-100 sm:max-w-md">
        <DialogHeader className="border-b border-slate-200 pb-2 dark:border-[#343434]">
          <DialogTitle className="font-display text-left tracking-tight text-slate-900 dark:text-slate-100">
            {isSubtaskMode ? "Create new subtask." : "Create new task."}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-3 py-1">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="title" className="text-slate-900 dark:text-slate-100">
                Title <span className="text-red-500">*</span>
              </Label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {title.length}/{TASK_SPRINT_NAME_MAX_LENGTH}
              </span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Enter task title"
              maxLength={TASK_SPRINT_NAME_MAX_LENGTH}
              className="h-8 max-w-full rounded-[2px] border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-500 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {titleError ? (
              <p className="text-xs text-red-500">{titleError}</p>
            ) : null}
          </div>

          {isSubtaskMode ? null : (
            <>
              <div className="min-w-0 space-y-1">
                <Label className="text-slate-900 dark:text-slate-100">
                  Start date
                </Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-full justify-start rounded-[2px] border-slate-200 bg-white px-3 text-left text-sm font-normal text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100",
                        !startDate && "text-slate-500 dark:text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto border-slate-200 bg-white p-0 dark:border-[#343434] dark:bg-[#1f1f1f]" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        onStartDateChange(date)

                        if (date && dueDate && isBeforeDate(dueDate, date)) {
                          onDueDateChange(undefined)
                        }

                        if (!date) {
                          onDueDateChange(undefined)
                          setDueDateOpen(false)
                        }

                        setStartDateOpen(false)
                      }}
                      disabled={isPastDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="min-w-0 space-y-1">
                <Label className="text-slate-900 dark:text-slate-100">
                  Due date
                </Label>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!startDate}
                      className={cn(
                        "h-8 w-full justify-start rounded-[2px] border-slate-200 bg-white px-3 text-left text-sm font-normal text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100",
                        !dueDate && "text-slate-500 dark:text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate
                        ? format(dueDate, "PPP")
                        : startDate
                        ? "Select date"
                        : "Select start date first"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto border-slate-200 bg-white p-0 dark:border-[#343434] dark:bg-[#1f1f1f]" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        onDueDateChange(date)
                        setDueDateOpen(false)
                      }}
                      disabled={(date) => isPastDate(date) || isBeforeStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <div className="min-w-0 space-y-1">
                  <Label className="text-slate-900 dark:text-slate-100">
                    Assign
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="!h-8 !min-h-8 w-full justify-between rounded-[2px] border-slate-200 bg-white px-2 py-0 text-left text-sm font-normal leading-none text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {selectedAssignee ? (
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px]">
                                {selectedAssignee.initials ?? "A"}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-[#4a4a4a] dark:bg-[#262626]">
                              <UserRound className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                            </span>
                          )}
                          <span className="truncate">
                            {selectedAssignee?.name ?? "Unassigned"}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                    >
                      <DropdownMenuItem
                        className={
                          !assigneeId
                            ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                            : undefined
                        }
                        onSelect={() => onAssigneeChange?.(null)}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-[#4a4a4a] dark:bg-[#262626]">
                          <UserRound className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                        </span>
                        <span className="flex-1">Unassigned</span>
                        <Check className={cn("h-4 w-4", !assigneeId ? "opacity-100" : "opacity-0")} />
                      </DropdownMenuItem>
                      {assigneeOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          className={
                            assigneeId === option.id
                              ? "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                              : undefined
                          }
                          onSelect={() => onAssigneeChange?.(option.id)}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[9px]">
                              {option.initials ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{option.name}</span>
                            {option.email ? (
                              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                                {option.email}
                              </span>
                            ) : null}
                          </span>
                          <Check className={cn("h-4 w-4", assigneeId === option.id ? "opacity-100" : "opacity-0")} />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="min-w-0 space-y-1">
                  <Label className="text-slate-900 dark:text-slate-100">
                    Priority
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="!h-8 !min-h-8 w-full justify-between rounded-[2px] border-slate-200 bg-white px-3 py-0 text-sm font-normal leading-none text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100"
                      >
                        <span className="flex items-center gap-2">
                          <PriorityIcon
                            priority={priority}
                            className={
                              priority === "High"
                                ? "h-3.5 w-3.5 text-red-500"
                                : priority === "Low"
                                ? "h-3.5 w-3.5 text-sky-500"
                                : "h-3.5 w-3.5 text-orange-500"
                            }
                          />
                          {priority}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-[6px] border-slate-200 bg-white p-1 shadow-md dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                    >
                      {(["Low", "Medium", "High"] as const).map((option) => (
                        <DropdownMenuItem
                          key={option}
                          className={cn(
                            "rounded-[4px] text-sm",
                            priority === option &&
                              "bg-slate-100 text-slate-900 dark:bg-[#303030] dark:text-slate-100"
                          )}
                          onSelect={() => onPriorityChange?.(option)}
                        >
                          <PriorityIcon priority={option} />
                          {option}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="description" className="text-slate-900 dark:text-slate-100">
                Description
              </Label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {normalizedDescription.length}/{TASK_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="description"
              value={normalizedDescription}
              onChange={(event) =>
                onDescriptionChange(event.target.value.slice(0, TASK_DESCRIPTION_MAX_LENGTH))
              }
              placeholder="Write a short description"
              maxLength={TASK_DESCRIPTION_MAX_LENGTH}
              wrap="soft"
              className="min-h-[112px] max-h-[112px] max-w-full resize-none overflow-y-auto break-words rounded-[2px] border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-500 [field-sizing:fixed] [overflow-wrap:anywhere] dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-2.5 dark:border-[#343434]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-24 rounded-[2px] border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
              size="sm"
            className="h-8 min-w-24 rounded-[2px] px-3 text-sm hover:opacity-90"
            onClick={onAddItem}
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting
              ? isSubtaskMode
                ? "Creating..."
                : "Adding..."
              : isSubtaskMode
              ? "Add subtask"
              : "Add item"}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  )
}
