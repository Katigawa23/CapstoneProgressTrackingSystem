import * as React from "react"

import {
  ChevronDown,
  Download,
  Ellipsis,
  Eye,
  FileText,
  ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"

import type { DashboardSubmission, TodoItem } from "../../types"
import type { SubmissionDraft } from "./types"
import { formatSubmissionSize } from "./utils"

type TaskSubmissionsSectionProps = {
  selectedTodo: TodoItem
  isSubmissionActionsOpen: boolean
  submissionDrafts: SubmissionDraft[]
  submissionThreads: DashboardSubmission[]
  isLoadingSubmissions: boolean
  isUploadingSubmission: boolean
  submissionInputRef: React.RefObject<HTMLInputElement | null>
  onSubmissionActionsOpenChange: (nextOpen: boolean) => void
  onSubmissionAttach: (todoId: string, files: FileList | null) => void
  onSubmissionUpload: (todoId: string) => void | Promise<void>
  onSubmissionDraftRemove: (todoId: string, draftId: string) => void
  onSubmissionDelete: (todoId: string, submissionId: string) => void | Promise<void>
}

function formatAttachmentDate(uploadedAt: string) {
  const uploadedDate = new Date(uploadedAt)

  if (Number.isNaN(uploadedDate.getTime())) {
    return "Recently added"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(uploadedDate)
}

function FilePreviewTile({
  fileName,
  fileType,
}: {
  fileName: string
  fileType: string
}) {
  const normalizedName = fileName.toLowerCase()
  const isImage =
    fileType.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((extension) =>
      normalizedName.endsWith(extension)
    )
  const isPdf =
    fileType === "application/pdf" || normalizedName.endsWith(".pdf")

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] border border-slate-300 bg-slate-100 dark:border-[#4a4a4a] dark:bg-[#303030]">
      <div className="relative flex h-5.5 w-4.5 items-center justify-center rounded-[2px] bg-white text-slate-700 shadow-sm dark:bg-slate-100">
        <div className="absolute right-0 top-0 h-1.5 w-1.5 rounded-bl-[2px] bg-slate-200 dark:bg-slate-300" />
        {isImage ? (
          <ImageIcon className="h-2.5 w-2.5" />
        ) : isPdf ? (
          <span className="text-[7px] font-bold tracking-tight text-slate-800">PDF</span>
        ) : (
          <FileText className="h-2.5 w-2.5" />
        )}
      </div>
    </div>
  )
}

function AttachmentList({
  submissions,
  backlogItemId,
  onSubmissionDelete,
}: {
  submissions: DashboardSubmission[]
  backlogItemId: string
  onSubmissionDelete: (todoId: string, submissionId: string) => void | Promise<void>
}) {
  return (
    <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#262626]">
      <div className="overflow-x-auto px-3 py-2">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(0,1.8fr)_88px_180px_76px] items-center gap-3 border-b border-slate-200 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:border-[#3a3a3a] dark:text-slate-400">
            <span>Name</span>
            <span>Size</span>
            <span>Date added</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-[#3a3a3a]">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="grid grid-cols-[minmax(0,1.8fr)_88px_180px_76px] items-center gap-3 rounded-[2px] px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-[#2c2c2c]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FilePreviewTile
                    fileName={submission.fileName}
                    fileType={submission.fileType}
                  />
                  <p className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                    {submission.fileName}
                  </p>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-300">
                  {formatSubmissionSize(submission.fileSize)}
                </p>
                <p className="text-[13px] text-slate-600 dark:text-slate-300">
                  {formatAttachmentDate(submission.uploadedAt)}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#343434] dark:hover:text-slate-200"
                    aria-label={`Open ${submission.fileName}`}
                    title="Open"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={submission.fileUrl}
                    download={submission.fileName}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#343434] dark:hover:text-slate-200"
                    aria-label={`Download ${submission.fileName}`}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    aria-label={`Delete ${submission.fileName}`}
                    title="Delete"
                    onClick={() =>
                      void onSubmissionDelete(backlogItemId, submission.id)
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TaskSubmissionsSection({
  selectedTodo,
  isSubmissionActionsOpen,
  submissionDrafts,
  submissionThreads,
  isLoadingSubmissions,
  isUploadingSubmission,
  submissionInputRef,
  onSubmissionActionsOpenChange,
  onSubmissionAttach,
  onSubmissionUpload,
  onSubmissionDraftRemove,
  onSubmissionDelete,
}: TaskSubmissionsSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  React.useEffect(() => {
    if (isSubmissionActionsOpen) {
      setIsExpanded(true)
    }
  }, [isSubmissionActionsOpen])

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(nextOpen) => {
        if (isSubmissionActionsOpen && !nextOpen) {
          return
        }

        setIsExpanded(nextOpen)
      }}
      className="mt-4 space-y-3"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="space-y-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-left text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} attachments`}
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isExpanded ? "rotate-0" : "-rotate-90"
                }`}
              />
              <span className="text-[15px] font-semibold">Attachments</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#343434] dark:text-slate-300">
                {submissionThreads.length}
              </span>
            </button>
          </CollapsibleTrigger>
          {isExpanded ? (
            <p className="pl-6 text-sm text-slate-500 dark:text-slate-400">
              Upload files or images for this task.
            </p>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-9 rounded-[2px] p-0 text-slate-700 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-200 dark:hover:bg-[#303030]"
            aria-label="More attachment actions"
            title="More"
          >
            <Ellipsis className="h-4 w-4" />
          </Button>

          {isSubmissionActionsOpen ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 rounded-[2px] text-slate-700 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-200 dark:hover:bg-[#303030]"
              onClick={() => onSubmissionActionsOpenChange(false)}
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-9 w-9 rounded-[2px] p-0 hover:opacity-90"
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
              disabled={isUploadingSubmission || isLoadingSubmissions}
              onClick={() => {
                setIsExpanded(true)
                onSubmissionActionsOpenChange(true)
              }}
              aria-label={
                submissionThreads.length > 0 ? "Add another attachment" : "Add attachment"
              }
              title={
                submissionThreads.length > 0 ? "Add another attachment" : "Add attachment"
              }
            >
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <CollapsibleContent className="space-y-2">

        {isSubmissionActionsOpen || submissionDrafts.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-9 gap-2"
                disabled={isUploadingSubmission}
                onClick={() => submissionInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Add attachment
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-9 gap-2"
                disabled={isUploadingSubmission}
                onClick={() => void onSubmissionUpload(selectedTodo.id)}
              >
                <Upload className="h-4 w-4" />
                {isUploadingSubmission ? "Submitting..." : "Submit for checking"}
              </Button>
            </div>
            {submissionDrafts.length > 0 ? (
              <div className="space-y-2">
                {submissionDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="relative overflow-hidden rounded-[2px] border border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/20"
                  >
                    <Progress
                      value={draft.progress}
                      className="absolute inset-0 h-full rounded-none border-0 bg-transparent [&_[data-slot=progress-indicator]]:bg-sky-400"
                    />
                    <div className="relative z-10 flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-800 dark:text-slate-200">
                          <p className="truncate font-medium">
                            {draft.file.name} ({formatSubmissionSize(draft.file.size)})
                          </p>
                          <span className="shrink-0 font-medium text-sky-900 dark:text-sky-300">
                            {draft.progress}%
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-sky-900 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300 dark:hover:bg-sky-900/40"
                        disabled={draft.status === "uploading"}
                        onClick={() => onSubmissionDraftRemove(selectedTodo.id, draft.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {draft.status === "error" ? (
                      <p className="relative z-10 px-3 pb-2 text-xs text-red-600">
                        Upload failed. Try submitting again.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add one or more files, then submit them for checking.
              </p>
            )}
          </>
        ) : null}

        <input
          ref={submissionInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt"
          onChange={(event) => {
            onSubmissionAttach(selectedTodo.id, event.target.files)
            event.target.value = ""
          }}
        />

        {!isSubmissionActionsOpen && submissionDrafts.length === 0 && isLoadingSubmissions ? (
          <div className="rounded-[2px] border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-400">
            Loading attachments...
          </div>
        ) : !isSubmissionActionsOpen &&
          submissionDrafts.length === 0 &&
          submissionThreads.length > 0 ? (
          <AttachmentList
            submissions={submissionThreads}
            backlogItemId={selectedTodo.id}
            onSubmissionDelete={onSubmissionDelete}
          />
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
