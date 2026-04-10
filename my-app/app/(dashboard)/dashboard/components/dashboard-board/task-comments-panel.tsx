import { Ellipsis, File, ImageIcon, Paperclip, Reply, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

import type { DashboardComment, TodoItem } from "../../types"
import { getInitials } from "../../utils"
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
}: TaskCommentsPanelProps) {
  return (
    <aside className="order-1 min-h-0 p-4 sm:p-5 lg:order-2 lg:p-6">
      <ScrollArea className="h-full pr-2 sm:pr-3 lg:pr-4">
        <div className="h-full">
          <div className="flex h-full min-h-[550px] flex-col rounded-xl border border-slate-200 p-4 dark:border-[#343434] dark:bg-[#262626]">
            <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {isLoadingComments ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading comments...</p>
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
                              className="ml-auto rounded-sm p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#303030] dark:hover:text-slate-200"
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
                          {comment.body.split(" ").map((part, index) =>
                            part.startsWith("@") ? (
                              <span
                                key={`${comment.id}-mention-${index}`}
                                className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              >
                                {part}
                              </span>
                            ) : (
                              <span key={`${comment.id}-text-${index}`}>{part}</span>
                            )
                          )}
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

            <div className="mt-auto pb-3 pt-4">
              {isEditingComments ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#343434] dark:bg-[#1f1f1f]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-[#343434]">
                    <button
                      type="button"
                      className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
                      onClick={() => commentImageInputRef.current?.click()}
                    >
                      <ImageIcon className="h-3 w-3" />
                      Image
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-slate-300 dark:hover:bg-[#303030]"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:border-[#454545] dark:hover:bg-[#2a2a2a]"
                  onClick={onCommentEditStart}
                >
                  {commentDraft || "Add a comment..."}
                </button>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
