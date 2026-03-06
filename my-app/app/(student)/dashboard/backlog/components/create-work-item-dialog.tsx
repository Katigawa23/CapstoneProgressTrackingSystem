"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Paperclip, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

import { type UploadItem } from "../types"

type CreateWorkItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  dueDate?: Date
  description: string
  uploadedFile: UploadItem | null
  onTitleChange: (value: string) => void
  onDueDateChange: (value: Date | undefined) => void
  onDescriptionChange: (value: string) => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: () => void
  onAddItem: () => void
}

export function CreateWorkItemDialog({
  open,
  onOpenChange,
  title,
  dueDate,
  description,
  uploadedFile,
  onTitleChange,
  onDueDateChange,
  onDescriptionChange,
  onFileChange,
  onRemoveFile,
  onAddItem,
}: CreateWorkItemDialogProps) {
  const [dateOpen, setDateOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setDateOpen(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-black sm:max-w-lg">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-left text-black">Create work item</DialogTitle>
          <DialogDescription className="text-left text-black/60">
            Add a new item to your backlog board.
          </DialogDescription>
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
              placeholder="Enter work item title"
              className="text-black placeholder:text-black/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-black">Due date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start border-black/20 text-left font-normal text-black",
                    !dueDate && "text-black/50"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    onDueDateChange(date)
                    setDateOpen(false)
                  }}
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

          <div className="space-y-3">
            <Label htmlFor="file-upload" className="text-black">
              File or image upload
            </Label>

            {!uploadedFile ? (
              <label
                htmlFor="file-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/20 bg-muted/30 px-4 py-8 text-center transition hover:bg-muted/50"
              >
                <Paperclip className="mb-3 h-5 w-5 text-black/70" />
                <span className="text-sm font-medium text-black">
                  Upload 1 file or image
                </span>
                <span className="mt-1 text-xs text-black/60">
                  PNG, JPG, PDF, DOCX, or any single attachment
                </span>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={onFileChange}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-black/15 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-md border border-black/10 p-2">
                    <Paperclip className="h-4 w-4 text-black/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-black/60">{uploadedFile.size}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveFile}
                  className="text-black hover:text-black"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="text-xs text-black/50">
              Only one upload is allowed for both file and image.
            </p>
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
