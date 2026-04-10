"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"

type EditWorkItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  startDate?: Date
  dueDate?: Date
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onStartDateChange: (value: Date | undefined) => void
  onDueDateChange: (value: Date | undefined) => void
  onSave: () => void
}

function isPastDate(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

export function EditWorkItemDialog({
  open,
  onOpenChange,
  title,
  description,
  startDate,
  dueDate,
  onTitleChange,
  onDescriptionChange,
  onStartDateChange,
  onDueDateChange,
  onSave,
}: EditWorkItemDialogProps) {
  const normalizeDate = (date: Date) => {
    const nextDate = new Date(date)
    nextDate.setHours(0, 0, 0, 0)
    return nextDate
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Edit work item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Title</label>
            <Input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Enter title"
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                    }
                  }}
                  disabled={(date) => isPastDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!startDate}
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate
                    ? format(dueDate, "PPP")
                    : startDate
                    ? "Pick a due date"
                    : "Pick a start date first"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={onDueDateChange}
                  disabled={(date) => isPastDate(date) || isBeforeStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Description</label>
            <Textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Enter description"
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
