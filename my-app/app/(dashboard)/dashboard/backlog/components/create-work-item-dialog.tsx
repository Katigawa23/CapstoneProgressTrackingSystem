"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

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

type CreateWorkItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  startDate?: Date
  dueDate?: Date
  description: string
  onTitleChange: (value: string) => void
  onStartDateChange: (value: Date | undefined) => void
  onDueDateChange: (value: Date | undefined) => void
  onDescriptionChange: (value: string) => void
  onAddItem: () => void
}

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  title,
  startDate,
  dueDate,
  description,
  onTitleChange,
  onStartDateChange,
  onDueDateChange,
  onDescriptionChange,
  onAddItem,
}: CreateWorkItemDialogProps) {
  const [startDateOpen, setStartDateOpen] = React.useState(false)
  const [dueDateOpen, setDueDateOpen] = React.useState(false)

  const normalizeDate = (date: Date) => {
    const nextDate = new Date(date)
    nextDate.setHours(0, 0, 0, 0)
    return nextDate
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-black sm:max-w-lg">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="font-display text-left tracking-tight text-black">Create new task.</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-black">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Enter task title"
              className="text-black placeholder:text-black/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-black">Start date</Label>
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start border-black/20 text-left font-normal text-black",
                    !startDate && "text-black/50"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Select date"}
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

          <div className="space-y-2">
            <Label className="text-black">Due date</Label>
            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!startDate}
                  className={cn(
                    "w-full justify-start border-black/20 text-left font-normal text-black",
                    !dueDate && "text-black/50"
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
              <PopoverContent className="w-auto p-0" align="start">
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

          <div className="space-y-2">
            <Label htmlFor="description" className="text-black">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Write a short description"
              className="min-h-[140px] resize-none text-black placeholder:text-black/50"
            />
          </div>

          <div className="flex gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-black/20 text-black"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onAddItem}
              disabled={!title.trim()}
            >
              Add item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
