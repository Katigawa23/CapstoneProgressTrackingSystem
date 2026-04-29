"use client"

import * as React from "react"
import { FolderCheck, GitFork } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"

import { columns } from "../../constants"
import type { DashboardComment, DashboardSubmission, TodoItem } from "../../types"
import { DashboardColumn } from "./dashboard-column"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDetailsSection } from "./task-details-section"
import { TaskSubmissionsSection } from "./task-submissions-section"
import { TaskSubtasksSection } from "./task-subtasks-section"
import type {
  CreateSubtaskInput,
  DashboardBoardProps,
  SubmissionDraft,
} from "./types"

export function DashboardBoard({
  todos,
  people,
  onStatusChange,
  onMoveTodo,
  onAssigneeChange,
  onTodoUpdate,
  onCreateSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
}: DashboardBoardProps) {
  const [draggingTodoId, setDraggingTodoId] = React.useState<string | null>(null)
  const [activeDropColumnId, setActiveDropColumnId] = React.useState<
    TodoItem["status"] | null
  >(null)
  const [activeDropTodoId, setActiveDropTodoId] = React.useState<string | null>(null)
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
  const [loadedTaskIds, setLoadedTaskIds] = React.useState<Record<string, true>>({})

  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentImageInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const submissionInputRef = React.useRef<HTMLInputElement | null>(null)
  const selectedTodoId = selectedTodo?.id ?? null

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

  React.useEffect(() => {
    if (!selectedTodoId) {
      return
    }

    const nextSelectedTodo = todos.find((todo) => todo.id === selectedTodoId)

    if (nextSelectedTodo && nextSelectedTodo !== selectedTodo) {
      setSelectedTodo(nextSelectedTodo)
    }
  }, [selectedTodo, selectedTodoId, todos])

  React.useEffect(() => {
    if (!selectedTodoId || loadedTaskIds[selectedTodoId]) {
      return
    }

    if (!(selectedTodoId in commentThreads) || !(selectedTodoId in submissionThreads)) {
      return
    }

    setLoadedTaskIds((current) => ({
      ...current,
      [selectedTodoId]: true,
    }))
  }, [commentThreads, loadedTaskIds, selectedTodoId, submissionThreads])

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

  const handleDragStartTodo = React.useCallback((todoId: string) => {
    setDraggingTodoId(todoId)
  }, [])

  const handleDragEndTodo = React.useCallback(() => {
    setDraggingTodoId(null)
    setActiveDropColumnId(null)
    setActiveDropTodoId(null)
  }, [])

  const handleDragEnterColumn = React.useCallback((columnId: TodoItem["status"]) => {
    setActiveDropColumnId(columnId)
    setActiveDropTodoId(null)
  }, [])

  const handleDragEnterCard = React.useCallback(
    (todoId: string, columnId: TodoItem["status"]) => {
      setActiveDropColumnId(columnId)
      setActiveDropTodoId(todoId)
    },
    []
  )

  const handleDropTodoToColumn = React.useCallback(
    (columnId: TodoItem["status"]) => {
      if (!draggingTodoId) {
        return
      }

      const draggingTodo = todos.find((todo) => todo.id === draggingTodoId)

      setDraggingTodoId(null)
      setActiveDropColumnId(null)
      setActiveDropTodoId(null)

      if (draggingTodo?.parentId) {
        void onStatusChange(draggingTodoId, columnId)
        return
      }

      void onMoveTodo(draggingTodoId, null, columnId)
    },
    [draggingTodoId, onMoveTodo, onStatusChange, todos]
  )

  const handleDropTodoOnCard = React.useCallback(
    (targetTodoId: string) => {
      if (!draggingTodoId || draggingTodoId === targetTodoId) {
        return
      }

      const draggingTodo = todos.find((todo) => todo.id === draggingTodoId)
      const targetTodo = todos.find((todo) => todo.id === targetTodoId)

      setDraggingTodoId(null)
      setActiveDropColumnId(null)
      setActiveDropTodoId(null)

      if (!draggingTodo || !targetTodo) {
        return
      }

      if (draggingTodo.parentId) {
        void onStatusChange(draggingTodoId, targetTodo.status)
        return
      }

      if (targetTodo.parentId) {
        void onMoveTodo(draggingTodoId, null, targetTodo.status)
        return
      }

      void onMoveTodo(draggingTodoId, targetTodoId, targetTodo.status)
    },
    [draggingTodoId, onMoveTodo, onStatusChange, todos]
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
          throw new Error("Failed to load submissions")
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
  }, [selectedTodoId, submissionThreads])

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

  const handleSubmissionDelete = React.useCallback(
    async (todoId: string, submissionId: string) => {
      try {
        const response = await fetch(
          `/api/backlog-items/${todoId}/submissions?submissionId=${encodeURIComponent(submissionId)}`,
          {
            method: "DELETE",
          }
        )

        if (!response.ok) {
          throw new Error("Failed to delete submission")
        }

        setSubmissionThreads((current) => ({
          ...current,
          [todoId]: (current[todoId] ?? []).filter(
            (submission) => submission.id !== submissionId
          ),
        }))
      } catch (error) {
        console.error(error)
      }
    },
    []
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
        console.error(error)
      }
    },
    [onCreateSubtask, selectedTodo]
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

  const handleDeleteSubtaskRow = React.useCallback(
    async (subtask: TodoItem) => {
      if (!selectedTodo) {
        return
      }

      try {
        await onDeleteSubtask(selectedTodo.id, subtask.id)
      } catch (error) {
        console.error(error)
      }
    },
    [onDeleteSubtask, selectedTodo]
  )

  const getColumnTodos = React.useCallback(
    (columnId: TodoItem["status"]) =>
      todos
        .filter((todo) => todo.status === columnId)
        .sort((left, right) => {
          if (left.parentId === right.parentId) {
            return left.orderIndex - right.orderIndex
          }

          if (!left.parentId && right.parentId) {
            return -1
          }

          if (left.parentId && !right.parentId) {
            return 1
          }

          return left.displayId.localeCompare(right.displayId)
        }),
    [todos]
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
    <>
      <Carousel opts={{ align: "start" }} className="w-full px-6 md:hidden">
        <CarouselContent>
          {columns.map((column) => {
            const columnTodos = getColumnTodos(column.id)

            return (
              <CarouselItem key={column.id}>
                <DashboardColumn
                  column={column}
                  todos={columnTodos}
                  allTodos={todos}
                  people={people}
                  activeDropColumnId={activeDropColumnId}
                  draggingTodoId={draggingTodoId}
                  activeDropTodoId={activeDropTodoId}
                  onStatusChange={onStatusChange}
                  onAssigneeChange={onAssigneeChange}
                  onDragStartTodo={handleDragStartTodo}
                  onDragEndTodo={handleDragEndTodo}
                  onDropTodoToColumn={handleDropTodoToColumn}
                  onDropTodoOnCard={handleDropTodoOnCard}
                  onDragEnterColumn={handleDragEnterColumn}
                  onDragEnterCard={handleDragEnterCard}
                  onOpenTask={handleOpenTask}
                  className="h-full"
                  scrollAreaClassName={
                    "h-[240px] w-full sm:h-[280px] md:h-[340px] xl:h-[420px]"
                  }
                />
              </CarouselItem>
            )
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0 top-1/2 size-6 border-border bg-background/95 transition-[background-color,border-color,color,box-shadow] duration-300" />
        <CarouselNext className="right-0 top-1/2 size-6 border-border bg-background/95 transition-[background-color,border-color,color,box-shadow] duration-300" />
      </Carousel>

      <div className="hidden min-h-0 flex-1 items-stretch gap-3 overflow-hidden md:grid md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTodos = getColumnTodos(column.id)

          return (
            <DashboardColumn
              key={column.id}
              column={column}
              todos={columnTodos}
              allTodos={todos}
              people={people}
              activeDropColumnId={activeDropColumnId}
              draggingTodoId={draggingTodoId}
              activeDropTodoId={activeDropTodoId}
              onStatusChange={onStatusChange}
              onAssigneeChange={onAssigneeChange}
              onDragStartTodo={handleDragStartTodo}
              onDragEndTodo={handleDragEndTodo}
              onDropTodoToColumn={handleDropTodoToColumn}
              onDropTodoOnCard={handleDropTodoOnCard}
              onDragEnterColumn={handleDragEnterColumn}
              onDragEnterCard={handleDragEnterCard}
              onOpenTask={handleOpenTask}
            />
          )
        })}
      </div>

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
                    onSubmissionDelete={handleSubmissionDelete}
                  />

                  {selectedTodo.parentId ||
                  (isSubmissionActionsOpen[selectedTodo.id] ?? false) ||
                  isUploadingSubmission ? null : (
                    <TaskSubtasksSection
                      checklist={selectedTodo.checklist}
                      subtasks={todos.filter((todo) => todo.parentId === selectedTodo.id)}
                      onAddSubtask={handleCreateSubtask}
                      onOpenSubtask={handleOpenSubtask}
                      onSubtaskStatusChange={onStatusChange}
                      onSubtaskAssigneeChange={onAssigneeChange}
                      onEditSubtaskTitle={handleEditSubtaskTitle}
                      onUpdateSubtask={onUpdateSubtask}
                      onDeleteSubtask={handleDeleteSubtaskRow}
                    />
                  )}
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
                onStatusChange={onStatusChange}
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
