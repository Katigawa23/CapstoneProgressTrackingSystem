import { Ellipsis, File, ImageIcon, Paperclip, Reply, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

import { StatusCombobox } from "../../backlog/components/status-combobox"
import type { DashboardComment, TodoItem } from "../../types"
import { formatDeadline, getInitials } from "../../utils"
import { formatCommentTime } from "./utils"

type TaskCommentsPanelProps = {
  selectedTodo: TodoItem
  comments: DashboardComment[]
  isLoadingComments: boolean
  isEditingComments: boolean
  commentDraft: string
  commentAssets: string[]
  commentImageInputRef: React.RefObject<HTMLInputElement | null>
  commentFileInputRef: React.RefObject<HTMLInputElement | null>
  onCommentDraftChange: (value: string) => void
  onCommentEditStart: () => void
  onCommentSave: () => void
  onCommentCancel: () => void
  onCommentAssetAttach: (todoId: string, files: FileList | null) => void
  onReplyToComment: (author: string) => void
  onEditComment: (comment: DashboardComment) => void
  onDeleteComment: (comment: DashboardComment) => void | Promise<void>
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function TaskCommentsPanel({
  selectedTodo,
  comments,
  isLoadingComments,
  isEditingComments,
  commentDraft,
  commentAssets,
  commentImageInputRef,
  commentFileInputRef,
  onCommentDraftChange,
  onCommentEditStart,
  onCommentSave,
  onCommentCancel,
  onCommentAssetAttach,
  onReplyToComment,
  onEditComment,
  onDeleteComment,
  onStatusChange,
}: TaskCommentsPanelProps) {
  const knownMentionNames = Array.from(
    new Set(
      comments
        .map((comment) => comment.author.trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length)
    )
  )
  const taskMeta = [
    { label: "Status", value: selectedTodo.status },
    {
      label: "Start date",
      value: selectedTodo.startDate
        ? formatDeadline(selectedTodo.startDate)
        : "No start date",
    },
    {
      label: "Due date",
      value: selectedTodo.deadline
        ? formatDeadline(selectedTodo.deadline)
        : "No due date",
    },
    { label: "Created by", value: "Not available" },
  ]

  const renderCommentSkeleton = () => (
    <div className="flex gap-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  )

  const renderCommentBody = (comment: DashboardComment) => {
    if (!comment.body) {
      return null
    }

    if (knownMentionNames.length === 0) {
      return (
        <span className="whitespace-pre-wrap break-words">{comment.body}</span>
      )
    }

    const mentionPattern = new RegExp(
      `@(?:${knownMentionNames.map(escapeRegExp).join("|")})`,
      "g"
    )
    const segments: Array<{ type: "text" | "mention"; value: string }> = []
    let lastIndex = 0

    for (const match of comment.body.matchAll(mentionPattern)) {
      const mention = match[0]
      const matchIndex = match.index ?? 0

      if (matchIndex > lastIndex) {
        segments.push({
          type: "text",
          value: comment.body.slice(lastIndex, matchIndex),
        })
      }

      segments.push({ type: "mention", value: mention })
      lastIndex = matchIndex + mention.length
    }

    if (lastIndex < comment.body.length) {
      segments.push({
        type: "text",
        value: comment.body.slice(lastIndex),
      })
    }

    if (segments.length === 0) {
      segments.push({ type: "text", value: comment.body })
    }

    return segments.map((segment, index) =>
      segment.type === "mention" ? (
        <span
          key={`${comment.id}-mention-${index}`}
          className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
        >
          {segment.value}
        </span>
      ) : (
        <span
          key={`${comment.id}-text-${index}`}
          className="whitespace-pre-wrap break-words"
        >
          {segment.value}
        </span>
      )
    )
  }

  return (
    <aside className="order-1 min-h-0 p-4 sm:p-5 lg:order-2 lg:p-6">
      <div className="flex h-full min-h-[550px] flex-col pr-2 sm:pr-3 lg:pr-4">
        <section className="mb-3 rounded-[2px] border border-slate-200 bg-slate-50/80 p-2.5 dark:border-[#343434] dark:bg-[#202020]">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Details
            </h3>
          </div>
          <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
            {taskMeta.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                {item.label === "Status" ? (
                  <div className="mt-0.5">
                    <StatusCombobox
                      value={selectedTodo.status}
                      onChange={(value) =>
                        onStatusChange(selectedTodo.id, value as TodoItem["status"])
                      }
                    />
                  </div>
                ) : (
                  <p className="mt-0.5 truncate text-xs text-slate-800 dark:text-slate-200">
                    {item.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="min-h-0 flex flex-1 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white p-4 dark:border-[#343434] dark:bg-[#1f1f1f]">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Comments
            </h3>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {isLoadingComments ? (
                <>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index}>{renderCommentSkeleton()}</div>
                  ))}
                </>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                      {getInitials(comment.author || "Unknown User")}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {comment.author}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatCommentTime(comment.createdAt)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="ml-auto rounded-[2px] p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#303030] dark:hover:text-slate-200"
                            >
                              <Ellipsis className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem onSelect={() => onEditComment(comment)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void onDeleteComment(comment)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {comment.body ? (
                        <div className="flex flex-wrap items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                          {renderCommentBody(comment)}
                        </div>
                      ) : null}
                      {comment.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {comment.attachments.map((asset) => (
                            <span
                              key={`${comment.id}-${asset}`}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-300"
                            >
                              <File className="h-3.5 w-3.5" />
                              {asset}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs transition hover:text-slate-700 dark:hover:text-slate-200"
                          onClick={() => onReplyToComment(comment.author)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                          <span>Reply</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs transition hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          <span>Like</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              )}
          </div>

          <div className="mt-auto pt-4">
            {isEditingComments ? (
              <div className="space-y-2 rounded-[2px] border border-slate-200 bg-white p-3 dark:border-[#343434] dark:bg-[#1f1f1f]">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-[#343434]">
                  <button
                    type="button"
                    className="inline-flex min-h-7 items-center gap-1.5 rounded-[2px] border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
                    onClick={() => commentImageInputRef.current?.click()}
                  >
                    <ImageIcon className="h-3 w-3" />
                    Image
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-7 items-center gap-1.5 rounded-[2px] border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
                    onClick={() => commentFileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3 w-3" />
                    Files
                  </button>
                  <input
                    ref={commentImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      onCommentAssetAttach(selectedTodo.id, event.target.files)
                      event.target.value = ""
                    }}
                  />
                  <input
                    ref={commentFileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      onCommentAssetAttach(selectedTodo.id, event.target.files)
                      event.target.value = ""
                    }}
                  />
                </div>
                <Textarea
                  value={commentDraft}
                  onChange={(event) => onCommentDraftChange(event.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-10 resize-none border-0 px-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-slate-200 sm:min-h-12"
                />
                {commentAssets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {commentAssets.map((asset) => (
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
                    onClick={onCommentSave}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-8 px-3"
                    onClick={onCommentCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full rounded-[2px] border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:border-[#454545] dark:hover:bg-[#2a2a2a]"
                onClick={onCommentEditStart}
              >
                {commentDraft || "Add a comment..."}
              </button>
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
