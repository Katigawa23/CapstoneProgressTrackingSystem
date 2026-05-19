"use client"

import * as React from "react"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"
import { Archive, FolderCheck, GitFork } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  broadcastDashboardActivitySync,
  subscribeToDashboardActivitySync,
} from "@/lib/dashboard-activity-sync"

import { columns } from "../../constants"
import type {
  DashboardComment,
  DashboardSubmission,
  DashboardWebLink,
  TodoItem,
} from "../../types"
import { DashboardColumn } from "./dashboard-column"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDetailsSection } from "./task-details-section"
import { TaskSubmissionsSection } from "./task-attachment-section"
import { TaskSubtasksSection } from "./task-subtasks-section"
import { TaskWebLinksSection } from "./task-web-links-section"
import type {
  CreateSubtaskInput,
  DashboardBoardProps,
  SubmissionDraft,
} from "./types"

const DOCUMENT_ATTACHMENT_LIMIT_BYTES = 5 * 1024 * 1024
const VIDEO_ATTACHMENT_LIMIT_BYTES = 10 * 1024 * 1024
const videoSubmissionFileExtensions = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogv",
  ".webm",
  ".wmv",
])

function getSubmissionFileExtension(fileName: string) {
  const extensionIndex = fileName.toLowerCase().lastIndexOf(".")
  return extensionIndex >= 0 ? fileName.toLowerCase().slice(extensionIndex) : ""
}

function isVideoSubmissionFile(file: File) {
  const fileType = file.type.toLowerCase()
  const extension = getSubmissionFileExtension(file.name)

  return fileType.startsWith("video/") || videoSubmissionFileExtensions.has(extension)
}

function getSubmissionFileSizeLimit(file: File) {
  return isVideoSubmissionFile(file)
    ? VIDEO_ATTACHMENT_LIMIT_BYTES
    : DOCUMENT_ATTACHMENT_LIMIT_BYTES
}

function formatAttachmentLimit(limit: number) {
  return `${Math.round(limit / (1024 * 1024))} MB`
}

export function DashboardBoard({
  todos,
  openTodoId = null,
  onTaskDialogClose,
  renderColumns = true,
  currentUserId = null,
  creatorNamesById = {},
  canManageOtherProjectResources = false,
  onStatusChange,
  onMoveTodo,
  onAssigneeChange,
  onPriorityChange,
  onTodoUpdate,
  onCreateSubtask,
  isCreatingSubtask = false,
  createSubtaskError = null,
  onCreateSubtaskInputChange,
  onUpdateSubtask,
  onArchiveTodo,
}: DashboardBoardProps) {
  const isMobile = useIsMobile()
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
  const [taskWebLinks, setTaskWebLinks] = React.useState<
    Record<string, DashboardWebLink[]>
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
  const [submissionAlertDescription, setSubmissionAlertDescription] = React.useState(
    "There is no content!"
  )
  const [isLoadingComments, setIsLoadingComments] = React.useState(false)
  const [isLoadingSubmissions, setIsLoadingSubmissions] = React.useState(false)
  const [isUploadingSubmission, setIsUploadingSubmission] = React.useState(false)
  const [loadedTaskIds, setLoadedTaskIds] = React.useState<Record<string, true>>({})
  const [pendingArchiveTodo, setPendingArchiveTodo] = React.useState<TodoItem | null>(null)
  const [pendingArchiveSubmission, setPendingArchiveSubmission] = React.useState<{
    todoId: string
    submission: DashboardSubmission
  } | null>(null)
  const [pendingArchiveLink, setPendingArchiveLink] = React.useState<{
    todoId: string
    link: DashboardWebLink
  } | null>(null)

  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentImageInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const submissionInputRef = React.useRef<HTMLInputElement | null>(null)
  const initializedCommentTodoIdRef = React.useRef<string | null>(null)
  const selectedTodoId = selectedTodo?.id ?? null

  React.useEffect(() => {
    if (!openTodoId) {
      return
    }

    const todoToOpen = todos.find((todo) => todo.id === openTodoId)

    if (!todoToOpen) {
      return
    }

    setOpenTarget("default")
    setSelectedTodo(todoToOpen)
  }, [openTodoId, todos])

  React.useEffect(() => {
    if (!selectedTodo) {
      initializedCommentTodoIdRef.current = null
      return
    }

    const isNewSelectedTodo = initializedCommentTodoIdRef.current !== selectedTodo.id

    if (!isNewSelectedTodo && openTarget !== "comments") {
      return
    }

    setDescriptionDraft(selectedTodo.description ?? "")
    if (isNewSelectedTodo) {
      setCommentDraft("")
    }
    setIsEditingDescription(false)
    setIsEditingComments(openTarget === "comments")
    setEditingCommentId(null)
    initializedCommentTodoIdRef.current = selectedTodo.id
  }, [openTarget, selectedTodo])

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const nextSelectedTodo = todos.find((todo) => todo.id === selectedTodoId)

    if (nextSelectedTodo && nextSelectedTodo !== selectedTodo) {
      setSelectedTodo(nextSelectedTodo)
      return
    }

    if (!nextSelectedTodo) {
      setSelectedTodo(null)
    }
  }, [selectedTodo, selectedTodoId, todos])

  React.useEffect(() => {
    if (!selectedTodoId || loadedTaskIds[selectedTodoId]) {
      return
    }

    if (
      !(selectedTodoId in commentThreads) ||
      !(selectedTodoId in submissionThreads) ||
      !(selectedTodoId in taskWebLinks)
    ) {
      return
    }

    setLoadedTaskIds((current) => ({
      ...current,
      [selectedTodoId]: true,
    }))
  }, [commentThreads, loadedTaskIds, selectedTodoId, submissionThreads, taskWebLinks])

  const handleOpenTask = React.useCallback(
    (todo: TodoItem, target: "default" | "comments" = "default") => {
      setOpenTarget(target)
      setSelectedTodo(todo)
    },
    []
  )

  const handleOpenSubtask = React.useCallback(
    (subtask: TodoItem) => {
      setOpenTarget("default")
      setSelectedTodo(subtask)
    },
    []
  )

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const todoId = selectedTodoId

    if (todoId in commentThreads) {
      return
    }

    let cancelled = false

    async function loadComments() {
      setIsLoadingComments(true)

      try {
        const response = await fetch(`/api/backlog-items/${todoId}/comments`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load comments")
        }

        const data = (await response.json()) as { comments: DashboardComment[] }

        if (!cancelled) {
          setCommentThreads((current) => ({
            ...current,
            [todoId]: data.comments,
          }))
          onTodoUpdate(todoId, { comments: data.comments.length })
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
  }, [commentThreads, onTodoUpdate, selectedTodoId])

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const todoId = selectedTodoId

    if (todoId in submissionThreads) {
      return
    }

    let cancelled = false

    async function loadSubmissions() {
      setIsLoadingSubmissions(true)

      try {
        const response = await fetch(
          `/api/backlog-items/${todoId}/submissions`,
          {
            cache: "no-store",
          }
        )

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}`
          let errorCode = "UNKNOWN"
          
          try {
            const errorData = await response.json()
            errorCode = errorData.code || "UNKNOWN"
            errorDetail = errorData.details ? `${errorCode}: ${errorData.details}` : errorData.error || errorDetail
          } catch (parseError) {
            // Response is not JSON, use generic error
          }
          
          const fullError = `Failed to load submissions - ${errorDetail}`
          console.error(`[${todoId}] ${fullError}`, { status: response.status, code: errorCode })
          throw new Error(fullError)
        }

        const data = (await response.json()) as {
          submissions: DashboardSubmission[]
        }

        if (!cancelled) {
          setSubmissionThreads((current) => ({
            ...current,
            [todoId]: data.submissions,
          }))
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`Error loading submissions for task ${todoId}: ${errorMsg}`)
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
  }, [selectedTodoId, submissionThreads])

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const todoId = selectedTodoId

    if (todoId in taskWebLinks) {
      return
    }

    let cancelled = false

    async function loadWebLinks() {
      try {
        const response = await fetch(`/api/backlog-items/${todoId}/links`, {
          cache: "no-store",
        })

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}`
          let errorCode = "UNKNOWN"
          
          try {
            const errorData = await response.json()
            errorCode = errorData.code || "UNKNOWN"
            errorDetail = errorData.details ? `${errorCode}: ${errorData.details}` : errorData.error || errorDetail
          } catch (parseError) {
            // Response is not JSON, use generic error
          }
          
          const fullError = `Failed to load web links - ${errorDetail}`
          console.error(`[${todoId}] ${fullError}`, { status: response.status, code: errorCode })
          throw new Error(fullError)
        }

        const data = (await response.json()) as {
          links: DashboardWebLink[]
        }

        if (!cancelled) {
          setTaskWebLinks((current) => ({
            ...current,
            [todoId]: data.links,
          }))
          onTodoUpdate(todoId, { links: data.links.length })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`Error loading web links for task ${todoId}: ${errorMsg}`)
      }
    }

    void loadWebLinks()

    return () => {
      cancelled = true
    }
  }, [onTodoUpdate, selectedTodoId, taskWebLinks])

  const refreshTaskResources = React.useCallback(
    async (todoId: string, options?: { signal?: AbortSignal }) => {
      try {
        const [submissionsResponse, linksResponse] = await Promise.all([
          fetch(`/api/backlog-items/${todoId}/submissions`, {
            cache: "no-store",
            signal: options?.signal,
          }),
          fetch(`/api/backlog-items/${todoId}/links`, {
            cache: "no-store",
            signal: options?.signal,
          }),
        ])

        if (!submissionsResponse.ok || !linksResponse.ok) {
          return
        }

        const [submissionsData, linksData] = await Promise.all([
          submissionsResponse.json() as Promise<{
            submissions: DashboardSubmission[]
          }>,
          linksResponse.json() as Promise<{ links: DashboardWebLink[] }>,
        ])

        setSubmissionThreads((current) => ({
          ...current,
          [todoId]: submissionsData.submissions,
        }))
        setTaskWebLinks((current) => ({
          ...current,
          [todoId]: linksData.links,
        }))
        onTodoUpdate(todoId, { links: linksData.links.length })
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Failed to refresh task resources", error)
        }
      }
    },
    [onTodoUpdate]
  )

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const controller = new AbortController()
    const todoId = selectedTodoId

    const syncSelectedTaskResources = async () => {
      await refreshTaskResources(todoId, { signal: controller.signal })
    }

    void syncSelectedTaskResources()

    const intervalId = window.setInterval(
      () => void syncSelectedTaskResources(),
      1000
    )

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [refreshTaskResources, selectedTodoId])

  React.useEffect(() => {
    return subscribeToDashboardActivitySync((payload) => {
      if (!payload.detailsChanged) {
        return
      }

      void refreshTaskResources(payload.itemId)
      setLoadedTaskIds((current) => {
        const next = { ...current }
        delete next[payload.itemId]
        return next
      })
    })
  }, [refreshTaskResources])

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

  const uploadSubmissionFile = React.useCallback(
    (todoId: string, draft: SubmissionDraft) =>
      new Promise<DashboardSubmission>((resolve, reject) => {
        const formData = new FormData()
        formData.append("files", draft.file)

        const request = new XMLHttpRequest()
        request.open("POST", `/api/backlog-items/${todoId}/submissions`)
        request.responseType = "json"
        let fallbackProgressTimer: number | null = null
        const initialProgress = Math.max(draft.progress, 8)

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

        updateDraftProgress(initialProgress, "uploading")

        if (initialProgress < 100) {
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
        }

        request.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) {
            return
          }

          const progress = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          )

          updateDraftProgress(Math.max(initialProgress, progress), "uploading")
        })

        request.addEventListener("load", () => {
          clearFallbackTimer()

          if (request.status < 200 || request.status >= 300) {
            const response = request.response as
              | { error?: string; details?: string }
              | null
            const errorMessage =
              response?.details || response?.error || "Failed to upload submission"
            reject(new Error(errorMessage))
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

  const handleSubmissionAttach = React.useCallback(
    (todoId: string, files: FileList | null) => {
      if (!files || files.length === 0) {
        return
      }

      const oversizedFile = Array.from(files).find((file) => {
        return file.size > getSubmissionFileSizeLimit(file)
      })

      if (oversizedFile) {
        const limit = getSubmissionFileSizeLimit(oversizedFile)
        setSubmissionAlertDescription(
          `Please choose ${oversizedFile.name} again. The limit is ${formatAttachmentLimit(limit)} for ${
            isVideoSubmissionFile(oversizedFile) ? "videos" : "documents and images"
          }.`
        )
        setIsEmptySubmissionAlertOpen(true)
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

      void (async () => {
        setIsUploadingSubmission(true)
        let uploadSucceeded = false

        try {
          const uploadedSubmissions: DashboardSubmission[] = []

          for (const draft of nextDrafts) {
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
              nextDrafts.some((item) => item.id === draft.id) && draft.status === "uploading"
                ? { ...draft, status: "error" }
                : draft
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
                (draft) => !nextDrafts.some((item) => item.id === draft.id)
              ),
            }))
            setIsUploadingSubmission(false)
          }, 500)
        }
      })()
    },
    [uploadSubmissionFile]
  )

  const handleSubmissionUpload = React.useCallback(
    async (todoId: string) => {
      const selectedFiles = submissionDrafts[todoId] ?? []

      if (selectedFiles.length === 0) {
        setSubmissionAlertDescription("There is no content!")
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
        broadcastDashboardActivitySync({ itemId: todoId, detailsChanged: true })
        void refreshTaskResources(todoId)
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
    [refreshTaskResources, submissionDrafts, uploadSubmissionFile]
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
                body: trimmedComment,
                attachments,
              }),
            })

        if (!response.ok) {
          let errorMessage = "Failed to save comment"

          try {
            const errorData = (await response.json()) as { error?: string }
            if (typeof errorData.error === "string" && errorData.error.trim()) {
              errorMessage = errorData.error.trim()
            }
          } catch {
            // Fall back to the generic message when the response is not JSON.
          }

          throw new Error(errorMessage)
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
    setSubmissionAlertDescription("There is no content!")
    onTaskDialogClose?.()
  }, [onTaskDialogClose])

  const handleCreateSubtask = React.useCallback(
    async (input: CreateSubtaskInput) => {
      if (!selectedTodo || !input.title.trim()) {
        return
      }

      try {
        await onCreateSubtask(selectedTodo, {
          title: input.title.trim(),
          description: input.description,
          startDate: input.startDate,
          dueDate: input.dueDate,
        })
      } catch (error) {
        throw error
      }
    },
    [onCreateSubtask, selectedTodo]
  )

  const handleAddWebLink = React.useCallback(
    async (todoId: string, value: { url: string; label: string }) => {
      try {
        const response = await fetch(`/api/backlog-items/${todoId}/links`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        })

        if (!response.ok) {
          throw new Error("Failed to save web link")
        }

        const data = (await response.json()) as { link: DashboardWebLink }
        const currentLinks = taskWebLinks[todoId] ?? []

        if (
          currentLinks.some(
            (link) => link.url === data.link.url && link.label === data.link.label
          )
        ) {
          return
        }

        const nextLinks = [data.link, ...currentLinks]

        setTaskWebLinks((current) => ({
          ...current,
          [todoId]: nextLinks,
        }))
        onTodoUpdate(todoId, { links: nextLinks.length })
        broadcastDashboardActivitySync({ itemId: todoId, detailsChanged: true })
        void refreshTaskResources(todoId)
      } catch (error) {
        console.error(error)
      }
    },
    [onTodoUpdate, refreshTaskResources, taskWebLinks]
  )

  const handleEditSubtaskTitle = React.useCallback(
    async (subtask: TodoItem, nextTitle: string) => {
      try {
        await onUpdateSubtask(subtask.id, {
          title: nextTitle,
          description: subtask.description,
          startDate: subtask.startDate,
          deadline: subtask.deadline,
        })
      } catch (error) {
        console.error(error)
      }
    },
    [onUpdateSubtask]
  )

  const canArchiveTodo = React.useCallback(
    (todo: TodoItem) => {
      const normalizedCurrentUserId = currentUserId?.trim() ?? ""

      return (
        canManageOtherProjectResources ||
        (Boolean(normalizedCurrentUserId) &&
          todo.createdByUserId === normalizedCurrentUserId)
      )
    },
    [canManageOtherProjectResources, currentUserId]
  )

  const handleArchiveTodoRequest = React.useCallback((todo: TodoItem) => {
    if (!canArchiveTodo(todo)) {
      return
    }

    setPendingArchiveTodo(todo)
  }, [canArchiveTodo])

  const handleArchiveSubmissionRequest = React.useCallback(
    (todoId: string, submission: DashboardSubmission) => {
      const normalizedCurrentUserId = currentUserId?.trim() ?? ""

      if (
        !canManageOtherProjectResources &&
        (!normalizedCurrentUserId ||
          submission.uploadedByUserId !== normalizedCurrentUserId)
      ) {
        return
      }

      setPendingArchiveSubmission({ todoId, submission })
    },
    [canManageOtherProjectResources, currentUserId]
  )

  const handleArchiveLinkRequest = React.useCallback(
    (todoId: string, link: DashboardWebLink) => {
      const normalizedCurrentUserId = currentUserId?.trim() ?? ""

      if (
        !canManageOtherProjectResources &&
        (!normalizedCurrentUserId || link.uploadedByUserId !== normalizedCurrentUserId)
      ) {
        return
      }

      setPendingArchiveLink({ todoId, link })
    },
    [canManageOtherProjectResources, currentUserId]
  )

  const handleConfirmArchiveTodo = React.useCallback(async () => {
    if (!pendingArchiveTodo) {
      return
    }

    try {
      await onArchiveTodo(pendingArchiveTodo)

      if (selectedTodo?.id === pendingArchiveTodo.id) {
        setSelectedTodo(null)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setPendingArchiveTodo(null)
    }
  }, [onArchiveTodo, pendingArchiveTodo, selectedTodo])

  const handleConfirmArchiveSubmission = React.useCallback(async () => {
    if (!pendingArchiveSubmission) {
      return
    }

    try {
      const response = await fetch(
        `/api/backlog-items/${pendingArchiveSubmission.todoId}/submissions/archive?submissionId=${encodeURIComponent(pendingArchiveSubmission.submission.id)}`,
        { method: "POST" }
      )

      if (!response.ok) {
        throw new Error("Failed to archive attachment")
      }

      setSubmissionThreads((current) => ({
        ...current,
        [pendingArchiveSubmission.todoId]: (current[pendingArchiveSubmission.todoId] ?? []).filter(
          (submission) => submission.id !== pendingArchiveSubmission.submission.id
        ),
      }))
      broadcastDashboardActivitySync({
        itemId: pendingArchiveSubmission.todoId,
        detailsChanged: true,
      })
      void refreshTaskResources(pendingArchiveSubmission.todoId)
    } catch (error) {
      console.error(error)
    } finally {
      setPendingArchiveSubmission(null)
    }
  }, [pendingArchiveSubmission, refreshTaskResources])

  const handleConfirmArchiveLink = React.useCallback(async () => {
    if (!pendingArchiveLink) {
      return
    }

    try {
      const response = await fetch(
        `/api/backlog-items/${pendingArchiveLink.todoId}/links/archive?linkId=${encodeURIComponent(pendingArchiveLink.link.id)}`,
        { method: "POST" }
      )

      if (!response.ok) {
        throw new Error("Failed to archive web link")
      }

      setTaskWebLinks((current) => ({
        ...current,
        [pendingArchiveLink.todoId]: (current[pendingArchiveLink.todoId] ?? []).filter(
          (link) => link.id !== pendingArchiveLink.link.id
        ),
      }))
      broadcastDashboardActivitySync({
        itemId: pendingArchiveLink.todoId,
        detailsChanged: true,
      })
      void refreshTaskResources(pendingArchiveLink.todoId)
    } catch (error) {
      console.error(error)
    } finally {
      setPendingArchiveLink(null)
    }
  }, [pendingArchiveLink, refreshTaskResources])

  const getColumnTodos = React.useCallback(
    (columnId: TodoItem["status"]) =>
      todos
        .filter((todo) => todo.status === columnId && !todo.parentId)
        .sort((left, right) => left.orderIndex - right.orderIndex),
    [todos]
  )

  const handleDragEnd = React.useCallback(
    (result: DropResult) => {
      const { destination, draggableId } = result

      if (!destination) {
        return
      }

      const sourceColumnId = result.source.droppableId as TodoItem["status"]
      const destinationColumnId = destination.droppableId as TodoItem["status"]
      const draggedTodo = todos.find((todo) => todo.id === draggableId)

      if (!draggedTodo) {
        return
      }

      if (draggedTodo.parentId) {
        if (draggedTodo.status !== destinationColumnId) {
          void onStatusChange(draggableId, destinationColumnId)
        }
        return
      }

      const destinationTodos = getColumnTodos(destinationColumnId)

      const isSamePosition =
        sourceColumnId === destinationColumnId &&
        result.source.index === destination.index

      if (isSamePosition) {
        return
      }

      const reorderedDestinationTodos =
        sourceColumnId === destinationColumnId
          ? destinationTodos.filter((todo) => todo.id !== draggableId)
          : destinationTodos

      const targetTodo =
        reorderedDestinationTodos
          .slice(destination.index)
          .find((todo) => !todo.parentId) ?? null

      void onMoveTodo(draggableId, targetTodo?.id ?? null, destinationColumnId)
    },
    [getColumnTodos, onMoveTodo, onStatusChange, todos]
  )

  const selectedTodoIdParts = React.useMemo(() => {
    if (!selectedTodo) {
      return null
    }

    if (!selectedTodo.parentId) {
      return {
        parentId: selectedTodo.displayId,
        subtaskId: null,
      }
    }

    const [parentIdPart, subtaskIdPart] = selectedTodo.displayId.split("/")

    return {
      parentId: parentIdPart ?? selectedTodo.displayId,
      subtaskId: subtaskIdPart ?? null,
    }
  }, [selectedTodo])

  const selectedParentTodo = React.useMemo(() => {
    if (!selectedTodo?.parentId) {
      return null
    }

    return todos.find((todo) => todo.id === selectedTodo.parentId) ?? null
  }, [selectedTodo, todos])
  const isFirstTaskOpenLoading = Boolean(
    selectedTodoId && !loadedTaskIds[selectedTodoId]
  )

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {renderColumns && isMobile ? (
      <Carousel opts={{ align: "start" }} className="w-full px-2 sm:px-4">
        <CarouselContent className="items-stretch">
          {columns.map((column) => {
            const columnTodos = getColumnTodos(column.id)

            return (
              <CarouselItem key={column.id} className="h-full">
                <DashboardColumn
                  column={column}
                  todos={columnTodos}
                  allTodos={todos}
                  currentUserId={currentUserId}
                  canManageOtherProjectResources={canManageOtherProjectResources}
                  onStatusChange={onStatusChange}
                  onAssigneeChange={onAssigneeChange}
                  onPriorityChange={onPriorityChange}
                  onOpenTask={handleOpenTask}
                  onArchiveTask={handleArchiveTodoRequest}
                  className="h-full"
                  scrollAreaClassName="h-[calc(100dvh-22rem)] min-h-[360px] w-full overflow-y-auto sm:h-[calc(100dvh-24rem)] sm:min-h-[420px] md:h-[340px] xl:h-[420px]"
                />
              </CarouselItem>
            )
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0 top-1/2 size-6 border-border bg-background/95 transition-[background-color,border-color,color,box-shadow] duration-300" />
        <CarouselNext className="right-0 top-1/2 size-6 border-border bg-background/95 transition-[background-color,border-color,color,box-shadow] duration-300" />
      </Carousel>
      ) : null}

      {renderColumns && !isMobile ? (
      <div className="min-h-0 w-full flex-1 items-stretch gap-3 overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-4">
        {columns.map((column) => {
          const columnTodos = getColumnTodos(column.id)

          return (
            <DashboardColumn
              key={column.id}
              column={column}
              todos={columnTodos}
              allTodos={todos}
              currentUserId={currentUserId}
              canManageOtherProjectResources={canManageOtherProjectResources}
              onStatusChange={onStatusChange}
              onAssigneeChange={onAssigneeChange}
              onPriorityChange={onPriorityChange}
              onOpenTask={handleOpenTask}
              onArchiveTask={handleArchiveTodoRequest}
            />
          )
        })}
      </div>
      ) : null}

      <Dialog open={selectedTodo !== null} onOpenChange={handleDialogOpenChange}>
        {selectedTodo ? (
          <DialogContent className="h-[92vh] max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-[var(--board-column-border)] bg-[var(--board-dialog-bg)] p-0 shadow-[var(--board-dialog-shadow)] transition-[background-color,border-color,box-shadow] duration-300 sm:h-[90vh] sm:max-h-[90vh] sm:w-[94vw] sm:max-w-[94vw] lg:h-[88vh] lg:max-h-[88vh] lg:w-[90vw] lg:max-w-[90vw]">
            <DialogHeader className="sr-only">
              <DialogTitle>{selectedTodo.title}</DialogTitle>
            </DialogHeader>
            {isFirstTaskOpenLoading ? (
              <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
                <div className="min-h-0 p-4 sm:p-5 lg:border-r lg:p-6 dark:border-[#343434]">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-52" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-28" />
                      <Skeleton className="h-16 w-full rounded-[2px]" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-28" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 w-9 rounded-[2px]" />
                          <Skeleton className="h-9 w-9 rounded-[2px]" />
                        </div>
                      </div>
                      <Skeleton className="h-14 w-full rounded-[2px]" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-24" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 w-9 rounded-[2px]" />
                          <Skeleton className="h-9 w-9 rounded-[2px]" />
                        </div>
                      </div>
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-24 w-full rounded-[2px]" />
                    </div>
                  </div>
                </div>

                <div className="min-h-0 p-4 sm:p-5 lg:p-6">
                  <div className="flex h-full min-h-[550px] flex-col gap-4">
                    <Skeleton className="h-32 w-full rounded-[2px]" />
                    <Skeleton className="flex-1 w-full rounded-[2px]" />
                    <Skeleton className="h-12 w-full rounded-[2px]" />
                  </div>
                </div>
              </div>
            ) : (
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
                        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] border border-slate-200 bg-slate-50 text-slate-600 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-300">
                            <FolderCheck className="h-3.5 w-3.5" />
                          </span>
                          <button
                            type="button"
                            className="rounded-sm transition hover:text-blue-600 hover:underline dark:hover:text-sky-400"
                            onClick={() => {
                              if (selectedParentTodo) {
                                handleOpenTask(selectedParentTodo)
                                return
                              }

                              handleOpenTask(selectedTodo)
                            }}
                          >
                            {selectedTodoIdParts?.parentId ?? selectedTodo.displayId}
                          </button>
                          {selectedTodoIdParts?.subtaskId ? (
                            <>
                              <span className="text-slate-400 dark:text-slate-500">/</span>
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] border border-slate-200 bg-slate-50 text-slate-600 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-300">
                                <GitFork className="h-3.5 w-3.5" />
                              </span>
                              <button
                                type="button"
                                className="rounded-sm transition hover:text-blue-600 hover:underline dark:hover:text-sky-400"
                                onClick={() => handleOpenTask(selectedTodo)}
                              >
                                {selectedTodoIdParts.subtaskId}
                              </button>
                            </>
                          ) : null}
                        </div>
                        <DialogTitle className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
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
                      <Separator className="mt-4 bg-slate-200 dark:bg-[#343434]" />
                    </>
                  ) : null}

                  <TaskSubmissionsSection
                    selectedTodo={selectedTodo}
                    currentUserId={currentUserId}
                    creatorNamesById={creatorNamesById}
                    canManageOtherProjectResources={canManageOtherProjectResources}
                    isSubmissionActionsOpen={
                      isSubmissionActionsOpen[selectedTodo.id] ?? false
                    }
                    submissionDrafts={submissionDrafts[selectedTodo.id] ?? []}
                    submissionThreads={submissionThreads[selectedTodo.id] ?? []}
                    isLoadingSubmissions={
                      isLoadingSubmissions && !(selectedTodo.id in submissionThreads)
                    }
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
                    onSubmissionArchive={handleArchiveSubmissionRequest}
                  />
                  <Separator className="mt-4 bg-slate-200 dark:bg-[#343434]" />

                  <TaskWebLinksSection
                    links={taskWebLinks[selectedTodo.id] ?? []}
                    currentUserId={currentUserId}
                    creatorNamesById={creatorNamesById}
                    canManageOtherProjectResources={canManageOtherProjectResources}
                    onAddLink={(value) => handleAddWebLink(selectedTodo.id, value)}
                    onArchiveLink={(value) => handleArchiveLinkRequest(selectedTodo.id, value)}
                  />

                  {selectedTodo.parentId ||
                  (isSubmissionActionsOpen[selectedTodo.id] ?? false) ||
                  isUploadingSubmission ? null : (
                    <>
                      <Separator className="mt-4 bg-slate-200 dark:bg-[#343434]" />
                      <TaskSubtasksSection
                        checklist={selectedTodo.checklist}
                        subtasks={todos.filter((todo) => todo.parentId === selectedTodo.id)}
                        currentUserId={currentUserId}
                        canManageOtherProjectResources={canManageOtherProjectResources}
                        creatorNamesById={creatorNamesById}
                        isSubmittingSubtask={isCreatingSubtask}
                        createSubtaskError={createSubtaskError}
                        onCreateSubtaskInputChange={onCreateSubtaskInputChange}
                        onAddSubtask={handleCreateSubtask}
                        onOpenSubtask={handleOpenSubtask}
                        onSubtaskStatusChange={onStatusChange}
                        onSubtaskAssigneeChange={onAssigneeChange}
                        onSubtaskPriorityChange={onPriorityChange}
                        onEditSubtaskTitle={handleEditSubtaskTitle}
                        onUpdateSubtask={onUpdateSubtask}
                        onArchiveSubtask={handleArchiveTodoRequest}
                      />
                    </>
                  )}
                </ScrollArea>
              </div>

              <TaskCommentsPanel
                selectedTodo={selectedTodo}
                currentUserId={currentUserId}
                creatorNamesById={creatorNamesById}
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
                onStatusChange={onStatusChange}
                onPriorityChange={onPriorityChange}
              />
            </div>
            )}
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
            <AlertDialogDescription>{submissionAlertDescription}</AlertDialogDescription>
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

      <AlertDialog
        open={pendingArchiveTodo !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingArchiveTodo(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 dark:border-[#343434] dark:bg-[#262626]">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <AlertDialogTitle>
                {pendingArchiveTodo?.parentId
                  ? `Archive Subtask ${pendingArchiveTodo.displayId.split("/").pop() ?? pendingArchiveTodo.displayId}`
                  : `Archive Task ${pendingArchiveTodo?.displayId}`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              {pendingArchiveTodo?.parentId ? (
                <>
                  <span className="block">
                    This subtask will be archived and removed from this task view. You won&apos;t be able to edit it while it is archived.
                  </span>
                  <span className="block">
                    You can restore this subtask later from Archives.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    This task and its subtasks will be archived. They won&apos;t appear in this space, and you won&apos;t be able to edit them while archived.
                  </span>
                  <span className="block">
                    You can restore this task anytime from Archives.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-amber-400 text-white hover:bg-amber-300"
              onClick={() => void handleConfirmArchiveTodo()}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingArchiveSubmission !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingArchiveSubmission(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 dark:border-[#343434] dark:bg-[#262626]">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <AlertDialogTitle>
                Archive Attachment
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span className="block">
                This attachment will be archived and removed from this task view.
              </span>
              <span className="block">
                You can restore it later from Archives.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-amber-400 text-white hover:bg-amber-300"
              onClick={() => void handleConfirmArchiveSubmission()}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingArchiveLink !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingArchiveLink(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 dark:border-[#343434] dark:bg-[#262626]">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <AlertDialogTitle>
                Archive Web Link
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span className="block">
                This web link will be archived and removed from this task view.
              </span>
              <span className="block">
                You can restore it later from Archives.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-amber-400 text-white hover:bg-amber-300"
              onClick={() => void handleConfirmArchiveLink()}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DragDropContext>
  )
}
