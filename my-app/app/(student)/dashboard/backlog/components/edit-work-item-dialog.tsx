"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type EditWorkItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSave: () => void
}

export function EditWorkItemDialog({
  open,
  onOpenChange,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSave,
}: EditWorkItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit field</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Title</label>
            <Input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Enter title"
            />
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