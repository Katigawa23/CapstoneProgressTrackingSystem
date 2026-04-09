import Image from "next/image"
import { FileText, Paperclip, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import type { DashboardSubmission, TodoItem } from "../../types"
import type { SubmissionDraft } from "./types"
import { formatSubmissionSize, formatSubmissionTime } from "./utils"

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
}: TaskSubmissionsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Submissions</h3>
          <p className="text-sm text-slate-500">
            Upload files or images for this task.
          </p>
        </div>
        {isSubmissionActionsOpen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 gap-2 text-slate-700"
            onClick={() => onSubmissionActionsOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
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
                    className="relative overflow-hidden rounded-xl border border-sky-200 bg-sky-50"
                  >
                    <Progress
                      value={draft.progress}
                      className="absolute inset-0 h-full rounded-none border-0 bg-transparent [&_[data-slot=progress-indicator]]:bg-sky-400"
                    />
                    <div className="relative z-10 flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-800">
                          <p className="truncate font-medium">
                            {draft.file.name} ({formatSubmissionSize(draft.file.size)})
                          </p>
                          <span className="shrink-0 font-medium text-sky-900">
                            {draft.progress}%
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-sky-900 transition hover:bg-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={draft.status === "uploading"}
                        onClick={() =>
                          onSubmissionDraftRemove(selectedTodo.id, draft.id)
                        }
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
              <p className="text-xs text-slate-500">
                Add one or more files, then submit them for checking.
              </p>
            )}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="min-h-9 gap-2"
            disabled={isUploadingSubmission}
            onClick={() => onSubmissionActionsOpenChange(true)}
          >
            <Upload className="h-4 w-4" />
            {submissionThreads.length > 0 ? "Submit another" : "Submit"}
          </Button>
        )}
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
      </div>

      {isLoadingSubmissions ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Loading submissions...
        </div>
      ) : submissionThreads.length > 0 ? (
        <div className="space-y-4">
          {submissionThreads.map((submission) => {
            const isImage = submission.fileType.startsWith("image/")
            const isPdf =
              submission.fileType === "application/pdf" ||
              submission.fileName.toLowerCase().endsWith(".pdf")

            return (
              <div
                key={submission.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-[#22232c] p-3 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {submission.fileName}
                    </p>
                    <p className="text-xs text-slate-300">
                      {formatSubmissionTime(submission.uploadedAt)} ·{" "}
                      {formatSubmissionSize(submission.fileSize)}
                    </p>
                  </div>
                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Open
                  </a>
                </div>

                {isPdf ? (
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-white">
                    <iframe
                      src={submission.fileUrl}
                      title={submission.fileName}
                      className="h-[420px] w-full bg-white"
                    />
                  </div>
                ) : isImage ? (
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-black/40">
                    <Image
                      src={submission.fileUrl}
                      alt={submission.fileName}
                      width={1400}
                      height={900}
                      className="max-h-[420px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-200">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {submission.fileName}
                      </p>
                      <p className="text-xs text-slate-300">
                        Preview is not available for this file type.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
