import * as React from "react"

import { CornerDownLeft, ChevronDown, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { AssigneeCombobox } from "../../backlog/components/assignee-combobox"
import { StatusCombobox } from "../../backlog/components/status-combobox"
import type { TodoItem } from "../../types"

type TaskSubtasksSectionProps = {
  checklist: string
  subtasks: TodoItem[]
  onAddSubtask: (title: string) => void | Promise<void>
  onOpenSubtask: (subtask: TodoItem) => void
  onSubtaskStatusChange: (subtaskId: string, nextStatus: TodoItem["status"]) => void
  onSubtaskAssigneeChange: (subtaskId: string, assigneeId: string | null) => void
  onEditSubtaskTitle: (subtask: TodoItem, nextTitle: string) => void | Promise<void>
  onDeleteSubtask: (subtask: TodoItem) => void | Promise<void>
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

export function TaskSubtasksSection({
  checklist,
  subtasks,
  onAddSubtask,
  onOpenSubtask,
  onSubtaskStatusChange,
  onSubtaskAssigneeChange,
  onEditSubtaskTitle,
  onDeleteSubtask,
}: TaskSubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState("")
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("")

  const progress = React.useMemo(
    () => parseChecklistProgress(checklist, subtasks.length),
    [checklist, subtasks.length]
  )
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

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

  const commitNewSubtask = React.useCallback(async () => {
    const nextTitle = newSubtaskTitle.trim()

    if (!nextTitle) {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
      return
    }

    try {
      await onAddSubtask(nextTitle)
    } finally {
      setIsCreatingSubtask(false)
      setNewSubtaskTitle("")
    }
  }, [newSubtaskTitle, onAddSubtask])

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="mt-4 space-y-3"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
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
            </button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#454f59] dark:bg-[#1d2125] dark:text-[#9fadbc] dark:hover:bg-[#24292f] dark:hover:text-[#dee4ea]"
              aria-label="More subtask actions"
              title="More"
            >
              <Ellipsis className="h-4 w-4" />
            </button>

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
          <div className="grid grid-cols-[minmax(0,1.55fr)_96px_132px_76px] items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-500 dark:border-[#2b3138] dark:bg-[#1d2125] dark:text-[#9fadbc]">
            <span>Work</span>
            <span className="text-center">Assignee</span>
            <span className="pl-1">Status</span>
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
              {subtasks.map((subtask) => {
                return (
                  <div
                    key={subtask.id}
                    className="grid grid-cols-[minmax(0,1.55fr)_96px_132px_76px] items-center gap-2 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50 dark:bg-[#1f1f23] dark:hover:bg-[#24292f]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <SubtaskGlyph />
                      {editingSubtaskId === subtask.id ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <Input
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onBlur={() => void commitTitleEdit(subtask)}
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
                            className="h-9 border-blue-300 bg-white text-sm text-slate-900 shadow-none dark:border-blue-500/60 dark:bg-[#1d2125] dark:text-[#dee4ea]"
                          />
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90"
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
                          className="truncate text-left text-sm text-slate-900 transition hover:text-blue-600 dark:text-[#dee4ea] dark:hover:text-[#8ab4ff]"
                          onClick={() => onOpenSubtask(subtask)}
                          title={`Open ${subtask.title}`}
                        >
                          {subtask.title}
                        </button>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <AssigneeCombobox
                        value={subtask.assigneeId}
                        onChange={(assigneeId) =>
                          onSubtaskAssigneeChange(subtask.id, assigneeId)
                        }
                        className="h-6 w-6 rounded-full border-slate-200 bg-transparent p-0 hover:bg-slate-100 dark:border-[#4c525a] dark:bg-[#3b3f45] dark:hover:bg-[#4a4f57]"
                        avatarClassName="h-6 w-6"
                        fallbackClassName="bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-[#3b3f45] dark:text-[#dee4ea]"
                        unassignedIconClassName="text-slate-500 dark:text-[#dee4ea]"
                        contentClassName="dark:border-[#454f59] dark:bg-[#1d2125]"
                      />
                    </div>

                    <div>
                      <StatusCombobox
                        value={subtask.status}
                        onChange={(nextStatus) =>
                          onSubtaskStatusChange(
                            subtask.id,
                            nextStatus as TodoItem["status"]
                          )
                        }
                        className="h-6 min-w-[88px] rounded-[2px] border-slate-300 bg-white px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-900 dark:border-[#c7cbd1] dark:bg-[#f1f2f4] dark:text-[#172b4d]"
                        contentClassName="dark:border-[#454f59] dark:bg-[#1d2125]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-[#9fadbc] dark:hover:bg-[#2c333a] dark:hover:text-[#dee4ea]"
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
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-[#9fadbc] dark:hover:bg-red-950/30 dark:hover:text-red-400"
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
            <div className="grid grid-cols-[minmax(0,1.55fr)_96px_132px_76px] items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5 dark:border-[#2b3138] dark:bg-[#1f1f23]">
              <div className="flex min-w-0 items-center gap-2">
                <SubtaskGlyph />
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(event) => setNewSubtaskTitle(event.target.value)}
                    onBlur={() => void commitNewSubtask()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void commitNewSubtask()
                      }

                      if (event.key === "Escape") {
                        setIsCreatingSubtask(false)
                        setNewSubtaskTitle("")
                      }
                    }}
                    autoFocus
                    placeholder="Create subtask title"
                    className="h-9 border-blue-300 bg-white text-sm text-slate-900 shadow-none dark:border-blue-500/60 dark:bg-[#1d2125] dark:text-[#dee4ea]"
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-primary text-primary-foreground transition hover:opacity-90"
                    aria-label="Create subtask"
                    title="Create"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void commitNewSubtask()}
                  >
                    <CornerDownLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div />
              <div />
              <div />
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
