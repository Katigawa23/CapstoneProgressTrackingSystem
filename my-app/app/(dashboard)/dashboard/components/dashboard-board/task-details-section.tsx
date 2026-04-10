import { CalendarDays, File, ImageIcon, Paperclip, Rows3, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import { cardStatusStyles } from "../../constants"
import type { TodoItem } from "../../types"
import { formatDeadline } from "../../utils"

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
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Description</h3>
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
              className="min-h-10 resize-none border-0 px-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 dark:text-slate-200 dark:bg-transparent sm:min-h-12"
            />

            {descriptionAssets.length > 0 && (
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
            )}

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
      </section>

      <section>
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-slate-50/60 shadow-none dark:border-[#343434] dark:bg-[#262626]">
          <CardContent className="px-2 py-00">
            <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2">
              <div className="flex items-center gap-1 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-400">
                  <Rows3 className="h-2.5 w-2.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Status
                  </p>
                  <Badge
                    variant="secondary"
                    className={`mt-0 h-4 border-0 px-1.5 text-[9px] ${cardStatusStyles[selectedTodo.status].className}`}
                  >
                    {cardStatusStyles[selectedTodo.status].label}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-400">
                  <CalendarDays className="h-2.5 w-2.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Start Date
                  </p>
                  <p className="mt-0 text-[11px] font-medium text-slate-800 dark:text-slate-200">
                    {formatDeadline(selectedTodo.startDate)}
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-200 my-0.5 dark:bg-[#3a3a3a]" />

            <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2">
              <div className="flex items-center gap-1 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-400">
                  <UserRound className="h-2.5 w-2.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Assignees
                  </p>
                  <p className="mt-0 truncate text-[11px] font-medium text-slate-800 dark:text-slate-200">
                    {selectedTodo.assignee || "No assignee"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-400">
                  <CalendarDays className="h-2.5 w-2.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Due Date
                  </p>
                  <p className="mt-0 text-[11px] font-medium text-slate-800 dark:text-slate-200">
                    {formatDeadline(selectedTodo.deadline)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
