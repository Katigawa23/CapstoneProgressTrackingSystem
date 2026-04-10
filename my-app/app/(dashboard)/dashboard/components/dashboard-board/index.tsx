"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  readClientAuthSession,
  subscribeToAuthChange,
  type AuthSession,
} from "@/lib/auth-client"

import { columns } from "../../constants"
import type { DashboardComment, DashboardSubmission, TodoItem } from "../../types"
import { DashboardColumn } from "./dashboard-column"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDetailsSection } from "./task-details-section"
import { TaskSubmissionsSection } from "./task-submissions-section"
import type { DashboardBoardProps, SubmissionDraft } from "./types"

export function DashboardBoard({
  todos,
  people,
  onStatusChange,
  onTodoUpdate,
  onCreate,
}: DashboardBoardProps) {
  const [authSession, setAuthSession] = React.useState<AuthSession | null>(null)
  const [selectedTodo, setSelectedTodo] = React.useState<TodoItem | null>(null)
  const [openTarget, setOpenTarget] = React.useState<"default" | "comments">(
    "default"
  )
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [isEditingComments, setIsEditingComments] = React.useState(false)
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = React.useState("")
  const [commentDraft, setCommentDraft] = React.useState("")
  const [descriptionAssets, setDescriptionAssets] = React.useState<
    Record<string, string[]>
  >({})
  const [commentAssets, setCommentAssets] = React.useState<Record<string, string[]>>(
    {}
  )
  const [commentThreads, setCommentThreads] = React.useState<
    Record<string, DashboardComment[]>
  >({})
  const [submissionThreads, setSubmissionThreads] = React.useState<
    Record<string, DashboardSubmission[]>
  >({})
  const [submissionDrafts, setSubmissionDrafts] = React.useState<
    Record<string, SubmissionDraft[]>
  >({})
  const [isSubmissionActionsOpen, setIsSubmissionActionsOpen] = React.useState<
    Record<string, boolean>
  >({})
  const [isEmptySubmissionAlertOpen, setIsEmptySubmissionAlertOpen] =
    React.useState(false)
  const [isLoadingComments, setIsLoadingComments] = React.useState(false)
  const [isLoadingSubmissions, setIsLoadingSubmissions] = React.useState(false)
  const [isUploadingSubmission, setIsUploadingSubmission] = React.useState(false)

  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentImageInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const submissionInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const syncSession = () => {
      setAuthSession(readClientAuthSession())
    }

    syncSession()
    const unsubscribe = subscribeToAuthChange(syncSession)

    return () => {
      unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    if (!selectedTodo) {
      return
    }

    setDescriptionDraft(selectedTodo.description ?? "")
    setCommentDraft("")
    setIsEditingDescription(false)
    setIsEditingComments(openTarget === "comments")
    setEditingCommentId(null)
  }, [openTarget, selectedTodo])

  const handleOpenTask = React.useCallback(
    (todo: TodoItem, target: "default" | "comments" = "default") => {
      setOpenTarget(target)
      setSelectedTodo(todo)
    },
    []
  )

  React.useEffect(() => {
    if (!selectedTodo) {
      return
    }

    const selectedTodoId = selectedTodo.id
    let cancelled = false

    async function loadComments() {
      setIsLoadingComments(true)

      try {
        const response = await fetch(`/api/backlog-items/${selectedTodoId}/comments`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load comments")
        }

        const data = (await response.json()) as { comments: DashboardComment[] }

        if (!cancelled) {
          setCommentThreads((current) => ({
            ...current,
            [selectedTodoId]: data.comments,
          }))
          onTodoUpdate(selectedTodoId, { comments: data.comments.length })
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) {
          setIsLoadingComments(false)
        }
      }
    }

    void loadComments()

    return () => {
      cancelled = true
    }
  }, [onTodoUpdate, selectedTodo])

  React.useEffect(() => {
    if (!selectedTodo) {
      return
    }

    const selectedTodoId = selectedTodo.id
    let cancelled = false

    async function loadSubmissions() {
      setIsLoadingSubmissions(true)

      try {
        const response = await fetch(
          `/api/backlog-items/${selectedTodoId}/submissions`,
          {
            cache: "no-store",
          }
        )

        if (!response.ok) {
          throw new Error("Failed to load submissions")
        }

        const data = (await response.json()) as {
          submissions: DashboardSubmission[]
        }

        if (!cancelled) {
          setSubmissionThreads((current) => ({
            ...current,
            [selectedTodoId]: data.submissions,
          }))
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) {
          setIsLoadingSubmissions(false)
        }
      }
    }

    void loadSubmissions()

    return () => {
      cancelled = true
    }
  }, [selectedTodo])

  const handleDescriptionSave = React.useCallback(() => {
    if (!selectedTodo) {
      return
    }

    onTodoUpdate(selectedTodo.id, { description: descriptionDraft })
    setSelectedTodo({ ...selectedTodo, description: descriptionDraft })
    setIsEditingDescription(false)
  }, [descriptionDraft, onTodoUpdate, selectedTodo])

  const handleAssetAttach = React.useCallback(
    (todoId: string, files: FileList | null) => {
      if (!files || files.length === 0) {
        return
      }

      setDescriptionAssets((current) => ({
        ...current,
        [todoId]: [
          ...(current[todoId] ?? []),
          ...Array.from(files).map((file) => file.name),
        ],
      }))
    },
    []
  )

  const handleCommentAssetAttach = React.useCallback(
    (todoId: string, files: FileList | null) => {
      if (!files || files.length === 0) {
        return
      }

      setCommentAssets((current) => ({
        ...current,
        [todoId]: [
          ...(current[todoId] ?? []),
          ...Array.from(files).map((file) => file.name),
        ],
      }))
    },
    []
  )

  const handleSubmissionAttach = React.useCallback(
    (todoId: string, files: FileList | null) => {
      if (!files || files.length === 0) {
        return
      }

      const nextDrafts = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 12,
        status: "pending" as const,
      }))

      setSubmissionDrafts((current) => ({
        ...current,
        [todoId]: [...(current[todoId] ?? []), ...nextDrafts],
      }))
      setIsSubmissionActionsOpen((current) => ({
        ...current,
        [todoId]: true,
      }))

      window.setTimeout(() => {
        setSubmissionDrafts((current) => ({
          ...current,
          [todoId]: (current[todoId] ?? []).map((draft) =>
            nextDrafts.some((item) => item.id === draft.id)
              ? { ...draft, progress: 100 }
              : draft
          ),
        }))
      }, 250)
    },
    []
  )

  const uploadSubmissionFile = React.useCallback(
    (todoId: string, draft: SubmissionDraft) =>
      new Promise<DashboardSubmission>((resolve, reject) => {
        const formData = new FormData()
        formData.append("files", draft.file)

        const request = new XMLHttpRequest()
        request.open("POST", `/api/backlog-items/${todoId}/submissions`)
        request.responseType = "json"
        let fallbackProgressTimer: number | null = null

        const clearFallbackTimer = () => {
          if (fallbackProgressTimer !== null) {
            window.clearInterval(fallbackProgressTimer)
            fallbackProgressTimer = null
          }
        }

        const updateDraftProgress = (
          progress: number,
          status: SubmissionDraft["status"]
        ) => {
          setSubmissionDrafts((current) => ({
            ...current,
            [todoId]: (current[todoId] ?? []).map((item) =>
              item.id === draft.id ? { ...item, progress, status } : item
            ),
          }))
        }

        updateDraftProgress(8, "uploading")

        fallbackProgressTimer = window.setInterval(() => {
          setSubmissionDrafts((current) => ({
            ...current,
            [todoId]: (current[todoId] ?? []).map((item) => {
              if (item.id !== draft.id || item.status === "complete") {
                return item
              }

              const nextProgress =
                item.progress >= 90 ? item.progress : item.progress + 12

              return {
                ...item,
                progress: nextProgress,
                status: "uploading",
              }
            }),
          }))
        }, 250)

        request.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) {
            return
          }

          const progress = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          )

          updateDraftProgress(progress, "uploading")
        })

        request.addEventListener("load", () => {
          clearFallbackTimer()

          if (request.status < 200 || request.status >= 300) {
            reject(new Error("Failed to upload submission"))
            return
          }

          const response = request.response as
            | { submissions?: DashboardSubmission[] }
            | null
          const uploadedSubmission = response?.submissions?.[0]

          if (!uploadedSubmission) {
            reject(new Error("Missing uploaded submission"))
            return
          }

          updateDraftProgress(100, "complete")
          resolve(uploadedSubmission)
        })

        request.addEventListener("error", () => {
          clearFallbackTimer()
          updateDraftProgress(draft.progress, "error")
          reject(new Error("Failed to upload submission"))
        })

        request.send(formData)
      }),
    []
  )

  const handleSubmissionDraftRemove = React.useCallback(
    (todoId: string, draftId: string) => {
      setSubmissionDrafts((current) => ({
        ...current,
        [todoId]: (current[todoId] ?? []).filter((draft) => draft.id !== draftId),
      }))
    },
    []
  )

  const handleSubmissionUpload = React.useCallback(
    async (todoId: string) => {
      const selectedFiles = submissionDrafts[todoId] ?? []

      if (selectedFiles.length === 0) {
        setIsEmptySubmissionAlertOpen(true)
        return
      }

      setIsUploadingSubmission(true)
      let uploadSucceeded = false

      try {
        const uploadedSubmissions: DashboardSubmission[] = []

        for (const draft of selectedFiles) {
          setSubmissionDrafts((current) => ({
            ...current,
            [todoId]: (current[todoId] ?? []).map((item) =>
              item.id === draft.id
                ? { ...item, status: "uploading", progress: item.progress || 0 }
                : item
            ),
          }))

          const uploadedSubmission = await uploadSubmissionFile(todoId, draft)
          uploadedSubmissions.push(uploadedSubmission)
        }

        setSubmissionThreads((current) => ({
          ...current,
          [todoId]: [...uploadedSubmissions.reverse(), ...(current[todoId] ?? [])],
        }))
        uploadSucceeded = true
      } catch (error) {
        console.error(error)
        setSubmissionDrafts((current) => ({
          ...current,
          [todoId]: (current[todoId] ?? []).map((draft) =>
            draft.status === "uploading" ? { ...draft, status: "error" } : draft
          ),
        }))
      } finally {
        if (!uploadSucceeded) {
          setIsUploadingSubmission(false)
          return
        }

        window.setTimeout(() => {
          setSubmissionDrafts((current) => ({
            ...current,
            [todoId]: (current[todoId] ?? []).filter(
              (draft) => draft.status !== "complete"
            ),
          }))
          setIsSubmissionActionsOpen((current) => ({
            ...current,
            [todoId]: false,
          }))
          setIsUploadingSubmission(false)
        }, 500)
      }
    },
    [submissionDrafts, uploadSubmissionFile]
  )

  const handleCommentSave = React.useCallback(() => {
    async function saveComment() {
      if (!selectedTodo) {
        return
      }

      const trimmedComment = commentDraft.trim()
      const attachments = commentAssets[selectedTodo.id] ?? []

      if (!trimmedComment && attachments.length === 0) {
        setIsEditingComments(false)
        setEditingCommentId(null)
        return
      }

      try {
        const response = editingCommentId
          ? await fetch(`/api/backlog-comments/${editingCommentId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                body: trimmedComment,
                attachments,
              }),
            })
          : await fetch(`/api/backlog-items/${selectedTodo.id}/comments`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                author: authSession?.user.name?.trim() || "Unknown User",
                body: trimmedComment,
                attachments,
              }),
            })

        if (!response.ok) {
          throw new Error("Failed to save comment")
        }

        const data = (await response.json()) as { comment: DashboardComment }
        const currentComments = commentThreads[selectedTodo.id] ?? []
        const nextComments = editingCommentId
          ? currentComments.map((comment) =>
              comment.id === editingCommentId ? data.comment : comment
            )
          : [...currentComments, data.comment]

        setCommentThreads((current) => ({
          ...current,
          [selectedTodo.id]: nextComments,
        }))
        onTodoUpdate(selectedTodo.id, { comments: nextComments.length })
        setCommentAssets((current) => ({
          ...current,
          [selectedTodo.id]: [],
        }))
        setCommentDraft("")
        setIsEditingComments(false)
        setEditingCommentId(null)
      } catch (error) {
        console.error(error)
      }
    }

    void saveComment()
  }, [
    authSession,
    commentAssets,
    commentDraft,
    commentThreads,
    editingCommentId,
    onTodoUpdate,
    selectedTodo,
  ])

  const handleReplyToComment = React.useCallback((author: string) => {
    setCommentDraft(`@${author} `)
    setIsEditingComments(true)
    setEditingCommentId(null)
  }, [])

  const handleEditComment = React.useCallback((comment: DashboardComment) => {
    setCommentDraft(comment.body)
    setCommentAssets((current) => ({
      ...current,
      [comment.backlogItemId]: comment.attachments,
    }))
    setEditingCommentId(comment.id)
    setIsEditingComments(true)
  }, [])

  const handleDeleteComment = React.useCallback(
    async (comment: DashboardComment) => {
      try {
        const response = await fetch(`/api/backlog-comments/${comment.id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete comment")
        }

        const currentComments = commentThreads[comment.backlogItemId] ?? []
        const nextComments = currentComments.filter((item) => item.id !== comment.id)

        setCommentThreads((current) => ({
          ...current,
          [comment.backlogItemId]: nextComments,
        }))
        onTodoUpdate(comment.backlogItemId, { comments: nextComments.length })

        if (editingCommentId === comment.id) {
          setCommentDraft("")
          setEditingCommentId(null)
          setIsEditingComments(false)
        }
      } catch (error) {
        console.error(error)
      }
    },
    [commentThreads, editingCommentId, onTodoUpdate]
  )

  const handleDialogOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      return
    }

    setSelectedTodo(null)
    setOpenTarget("default")
    setIsEditingDescription(false)
    setIsEditingComments(false)
    setEditingCommentId(null)
    setIsEmptySubmissionAlertOpen(false)
  }, [])

  return (
    <>
      <Carousel opts={{ align: "start" }} className="w-full px-6 md:hidden">
        <CarouselContent>
          {columns.map((column) => {
            const columnTodos = todos.filter((todo) => todo.status === column.id)
            const hasTodos = columnTodos.length > 0

            return (
              <CarouselItem key={column.id}>
                <DashboardColumn
                  column={column}
                  todos={columnTodos}
                  people={people}
                  onStatusChange={onStatusChange}
                  onOpenTask={handleOpenTask}
                  onCreate={onCreate}
                  className="h-full"
                  scrollAreaClassName={
                    hasTodos
                      ? "w-full max-h-[min(58vh,420px)]"
                      : "min-h-[240px] max-h-[240px] w-full"
                  }
                />
              </CarouselItem>
            )
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0 top-1/2 size-6 border-border bg-background/95" />
        <CarouselNext className="right-0 top-1/2 size-6 border-border bg-background/95" />
      </Carousel>

      <div className="hidden min-h-0 flex-1 items-stretch gap-3 overflow-hidden md:grid md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTodos = todos.filter((todo) => todo.status === column.id)

          return (
            <DashboardColumn
              key={column.id}
              column={column}
              todos={columnTodos}
              people={people}
              onStatusChange={onStatusChange}
              onOpenTask={handleOpenTask}
              onCreate={onCreate}
            />
          )
        })}
      </div>

      <Dialog open={selectedTodo !== null} onOpenChange={handleDialogOpenChange}>
        {selectedTodo ? (
          <DialogContent className="h-[92vh] max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-200 bg-white p-0 dark:border-[#343434] dark:bg-[#1f1f1f] sm:h-[90vh] sm:max-h-[90vh] sm:w-[94vw] sm:max-w-[94vw] lg:h-[88vh] lg:max-h-[88vh] lg:w-[90vw] lg:max-w-[90vw]">
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedTodo.title}</DialogTitle>
            </DialogHeader>
            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
              <div
                className={`min-h-0 p-4 sm:p-5 lg:p-6 ${
                  isSubmissionActionsOpen[selectedTodo.id]
                    ? "order-1 border-slate-200 pt-10 dark:border-[#343434] sm:pt-12 lg:border-r lg:pt-12"
                    : "order-2 border-t border-slate-200 dark:border-[#343434] lg:order-1 lg:border-r lg:border-t-0"
                }`}
              >
                <ScrollArea className="h-full pr-2 sm:pr-3 lg:pr-4">
                  {!isSubmissionActionsOpen[selectedTodo.id] ? (
                    <>
                      <DialogHeader className="mb-5 text-left sm:mb-6">
                        <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                          {selectedTodo.title}
                        </DialogTitle>
                      </DialogHeader>

                      <TaskDetailsSection
                        selectedTodo={selectedTodo}
                        isEditingDescription={isEditingDescription}
                        descriptionDraft={descriptionDraft}
                        descriptionAssets={descriptionAssets[selectedTodo.id] ?? []}
                        imageInputRef={imageInputRef}
                        fileInputRef={fileInputRef}
                        onDescriptionDraftChange={setDescriptionDraft}
                        onDescriptionEditStart={() => setIsEditingDescription(true)}
                        onDescriptionSave={handleDescriptionSave}
                        onDescriptionCancel={() => {
                          setDescriptionDraft(selectedTodo.description ?? "")
                          setIsEditingDescription(false)
                        }}
                        onAssetAttach={handleAssetAttach}
                      />
                    </>
                  ) : null}

                  <TaskSubmissionsSection
                    selectedTodo={selectedTodo}
                    isSubmissionActionsOpen={
                      isSubmissionActionsOpen[selectedTodo.id] ?? false
                    }
                    submissionDrafts={submissionDrafts[selectedTodo.id] ?? []}
                    submissionThreads={submissionThreads[selectedTodo.id] ?? []}
                    isLoadingSubmissions={isLoadingSubmissions}
                    isUploadingSubmission={isUploadingSubmission}
                    submissionInputRef={submissionInputRef}
                    onSubmissionActionsOpenChange={(nextOpen) =>
                      setIsSubmissionActionsOpen((current) => ({
                        ...current,
                        [selectedTodo.id]: nextOpen,
                      }))
                    }
                    onSubmissionAttach={handleSubmissionAttach}
                    onSubmissionUpload={handleSubmissionUpload}
                    onSubmissionDraftRemove={handleSubmissionDraftRemove}
                  />
                </ScrollArea>
              </div>

              <TaskCommentsPanel
                selectedTodo={selectedTodo}
                comments={commentThreads[selectedTodo.id] ?? []}
                isLoadingComments={isLoadingComments}
                isEditingComments={isEditingComments}
                commentDraft={commentDraft}
                commentAssets={commentAssets[selectedTodo.id] ?? []}
                commentImageInputRef={commentImageInputRef}
                commentFileInputRef={commentFileInputRef}
                onCommentDraftChange={setCommentDraft}
                onCommentEditStart={() => setIsEditingComments(true)}
                onCommentSave={handleCommentSave}
                onCommentCancel={() => {
                  setCommentDraft("")
                  setCommentAssets((current) => ({
                    ...current,
                    [selectedTodo.id]: [],
                  }))
                  setEditingCommentId(null)
                  setIsEditingComments(false)
                }}
                onCommentAssetAttach={handleCommentAssetAttach}
                onReplyToComment={handleReplyToComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
              />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        open={isEmptySubmissionAlertOpen}
        onOpenChange={setIsEmptySubmissionAlertOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle>Alert</AlertDialogTitle>
            <AlertDialogDescription>There is no content!</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-start sm:justify-start">
            <AlertDialogAction
              size="xs"
              className="min-w-16 px-3"
              onClick={() => setIsEmptySubmissionAlertOpen(false)}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
