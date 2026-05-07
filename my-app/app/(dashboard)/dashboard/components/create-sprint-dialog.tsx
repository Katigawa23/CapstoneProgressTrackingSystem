"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type SprintScopeOption = {
  id: string
  label: string
}

type CreateSprintDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sprintName: string
  duration: string
  startDate?: Date
  endDate?: Date
  scopeItemId: string
  description: string
  sprintNameError?: string | null
  scopeOptions: SprintScopeOption[]
  onSprintNameChange: (value: string) => void
  onDurationChange: (value: string) => void
  onStartDateChange: (value: Date | undefined) => void
  onEndDateChange: (value: Date | undefined) => void
  onScopeItemChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  isSubmitting?: boolean
  onCreateSprint: () => void
}

const DURATION_OPTIONS = [
  { value: "1-week", label: "1 week", days: 6 },
  { value: "2-weeks", label: "2 weeks", days: 13 },
  { value: "3-weeks", label: "3 weeks", days: 20 },
  { value: "custom", label: "Custom", days: null },
] as const

function normalizeDate(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function isSameCalendarDate(left?: Date, right?: Date) {
  if (!left && !right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return normalizeDate(left).getTime() === normalizeDate(right).getTime()
}

export function CreateSprintDialog({
  open,
  onOpenChange,
  sprintName,
  duration,
  startDate,
  endDate,
  scopeItemId,
  description,
  sprintNameError = null,
  scopeOptions,
  onSprintNameChange,
  onDurationChange,
  onStartDateChange,
  onEndDateChange,
  onScopeItemChange,
  onDescriptionChange,
  isSubmitting = false,
  onCreateSprint,
}: CreateSprintDialogProps) {
  const [startDateOpen, setStartDateOpen] = React.useState(false)
  const [endDateOpen, setEndDateOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setStartDateOpen(false)
      setEndDateOpen(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!startDate) {
      if (endDate) {
        onEndDateChange(undefined)
      }
      return
    }

    const selectedDuration =
      DURATION_OPTIONS.find((option) => option.value === duration) ?? null

    if (selectedDuration?.days == null) {
      if (endDate && normalizeDate(endDate) < normalizeDate(startDate)) {
        onEndDateChange(undefined)
      }
      return
    }

    const nextEndDate = addDays(startDate, selectedDuration.days)

    if (!isSameCalendarDate(endDate, nextEndDate)) {
      onEndDateChange(nextEndDate)
    }
  }, [duration, endDate, onEndDateChange, startDate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2px] border-slate-200 bg-white px-5 py-4 text-slate-900 dark:border-[#343434] dark:bg-[#171717] dark:text-slate-100 sm:max-w-md">
        <DialogHeader className="border-b border-slate-200 pb-2 dark:border-[#343434]">
          <DialogTitle className="font-display text-left tracking-tight text-slate-900 dark:text-slate-100">
            Start Sprint
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-1">
          <div className="max-w-[220px] space-y-1">
            <Label htmlFor="sprint-name">
              Sprint name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sprint-name"
              value={sprintName}
              onChange={(event) => onSprintNameChange(event.target.value)}
              placeholder="Sprint 13"
              className="h-7 rounded-[2px] border-slate-200 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f]"
            />
            {sprintNameError ? (
              <p className="text-xs text-red-500">{sprintNameError}</p>
            ) : null}
          </div>

          <div className="max-w-[200px] space-y-1">
            <Label htmlFor="sprint-duration">
              Duration <span className="text-red-500">*</span>
            </Label>
            <Select value={duration} onValueChange={onDurationChange}>
              <SelectTrigger
                id="sprint-duration"
                className="h-7 rounded-[2px] border-slate-200 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f]"
              >
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid max-w-[420px] grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Start date <span className="text-red-500">*</span>
              </Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                  variant="outline"
                  className={cn(
                    "h-7 w-full justify-start rounded-[2px] border-slate-200 bg-white px-2.5 text-left text-sm font-normal dark:border-[#343434] dark:bg-[#1f1f1f]",
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
                      if (!isSameCalendarDate(startDate, date)) {
                        onStartDateChange(date)
                      }
                      setStartDateOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label>
                End date <span className="text-red-500">*</span>
              </Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                  variant="outline"
                  disabled={!startDate}
                  className={cn(
                      "h-7 w-full justify-start rounded-[2px] border-slate-200 bg-white px-2.5 text-left text-sm font-normal dark:border-[#343434] dark:bg-[#1f1f1f]",
                      !endDate && "text-slate-500 dark:text-slate-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "PPP")
                      : startDate
                      ? "Select date"
                      : "Select start date first"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto border-slate-200 bg-white p-0 dark:border-[#343434] dark:bg-[#1f1f1f]" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (!isSameCalendarDate(endDate, date)) {
                        onEndDateChange(date)
                      }
                      setEndDateOpen(false)
                    }}
                    disabled={(date) =>
                      startDate ? normalizeDate(date) < normalizeDate(startDate) : false
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="max-w-[220px] space-y-1">
            <Label htmlFor="sprint-scope">Work items</Label>
            <Select
              value={scopeItemId || undefined}
              onValueChange={onScopeItemChange}
            >
              <SelectTrigger
                id="sprint-scope"
                disabled={scopeOptions.length === 0}
                className="h-7 rounded-[2px] border-slate-200 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f]"
              >
                <SelectValue placeholder="Select work item" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sprint-description">Description</Label>
            <Textarea
              id="sprint-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Describe the sprint goal and focus."
              className="min-h-[72px] resize-none rounded-[2px] border-slate-200 bg-white text-sm dark:border-[#343434] dark:bg-[#1f1f1f]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-2.5 dark:border-[#343434]">
            <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 min-w-18 rounded-[2px] border-slate-200 bg-white px-3 text-sm dark:border-[#343434] dark:bg-[#1f1f1f]"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            style={{
              backgroundColor: "var(--brand-primary-fixed)",
              color: "var(--brand-primary-fixed-foreground)",
            }}
            className="h-7 min-w-18 rounded-[2px] px-3 text-sm hover:opacity-90"
            onClick={onCreateSprint}
            disabled={isSubmitting || !sprintName.trim()}
          >
            {isSubmitting ? "Starting..." : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
