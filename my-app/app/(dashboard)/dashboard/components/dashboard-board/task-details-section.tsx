import * as React from "react"

import { ChevronDown, File, ImageIcon, Paperclip } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"

import type { TodoItem } from "../../types"

type TaskDetailsSectionProps = {
  selectedTodo: TodoItem
  isEditingDescription: boolean
  descriptionDraft: string
  descriptionAssets: string[]
  imageInputRef: React.RefObject<HTMLInputElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDescriptionDraftChange: (value: string) => void
  onDescriptionEditStart: () => void
  onDescriptionSave: () => void
  onDescriptionCancel: () => void
  onAssetAttach: (todoId: string, files: FileList | null) => void
}

export function TaskDetailsSection({
  selectedTodo,
  isEditingDescription,
  descriptionDraft,
  descriptionAssets,
  imageInputRef,
  fileInputRef,
  onDescriptionDraftChange,
  onDescriptionEditStart,
  onDescriptionSave,
  onDescriptionCancel,
  onAssetAttach,
}: TaskDetailsSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  React.useEffect(() => {
    if (isEditingDescription) {
      setIsExpanded(true)
    }
  }, [isEditingDescription])

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(nextOpen) => {
        if (isEditingDescription && !nextOpen) {
          return
        }

        setIsExpanded(nextOpen)
      }}
      className="space-y-2"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-left text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} description`}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          <span className="text-[15px] font-semibold">Description</span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2">
        {isEditingDescription ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#343434] dark:bg-[#262626]">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-[#343434]">
              <button
                type="button"
                className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon className="h-3 w-3" />
                Image
              </button>
              <button
                type="button"
                className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3 w-3" />
                Files
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(event) => {
                  onAssetAttach(selectedTodo.id, event.target.files)
                  event.target.value = ""
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(event) => {
                  onAssetAttach(selectedTodo.id, event.target.files)
                  event.target.value = ""
                }}
              />
            </div>

            <Textarea
              value={descriptionDraft}
              onChange={(event) => onDescriptionDraftChange(event.target.value)}
              placeholder="Add a description..."
              className="min-h-10 resize-none border-0 px-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-slate-200 sm:min-h-12"
            />

            {descriptionAssets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {descriptionAssets.map((asset) => (
                  <span
                    key={asset}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-300"
                  >
                    <File className="h-3.5 w-3.5" />
                    {asset}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="min-h-8 px-3"
                onClick={onDescriptionSave}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-8 px-3"
                onClick={onDescriptionCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white dark:border-[#343434] dark:bg-[#262626] dark:text-slate-300 dark:hover:border-[#454545] dark:hover:bg-[#2a2a2a] sm:p-4"
            onClick={onDescriptionEditStart}
          >
            {selectedTodo.description || "Add a description..."}
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
