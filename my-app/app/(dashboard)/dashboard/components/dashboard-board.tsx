import * as React from "react"
import { Ellipsis, File, ImageIcon, Paperclip, Plus, Reply, ThumbsUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

import { columns } from "../constants"
import type { ColumnId, DashboardComment, TodoItem } from "../types"
import { DashboardTaskCard } from "./dashboard-task-card"

type Person = {
  name: string
  src: string
}

type DashboardBoardProps = {
  todos: TodoItem[]
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onTodoUpdate: (todoId: string, updates: Partial<TodoItem>) => void
  onCreate: (status: ColumnId) => void
}

function DashboardColumn({
  column,
  todos,
  people,
  onStatusChange,
  onOpenTask,
  onCreate,
  className = "",
  scrollAreaClassName,
}: {
  column: (typeof columns)[number]
  todos: TodoItem[]
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onOpenTask: (todo: TodoItem, target?: "default" | "comments") => void
  onCreate: (status: ColumnId) => void
  className?: string
  scrollAreaClassName?: string
}) {
  const hasTodos = todos.length > 0

  return (
    <Card
      className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl ${className}`}
    >
      <CardHeader className="px-3 pb-2 pt-3">
        <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className={`h-2 w-2 rounded-full ${column.color}`} />
          <span className="truncate">{column.title}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
        <ScrollArea
          className={
            scrollAreaClassName ??
            (hasTodos
              ? `
                  w-full max-h-[180px]
                  sm:max-h-[260px]
                  lg:max-h-[340px]
                  xl:max-h-[420px]
                `
              : "min-h-[170px] w-full")
          }
        >
          <div className={`space-y-2 p-0.5 pr-2 ${hasTodos ? "" : "h-full"}`}>
            {todos.map((todo) => (
              <DashboardTaskCard
                key={todo.id}
                todo={todo}
                people={people}
                onStatusChange={onStatusChange}
                onOpen={onOpenTask}
              />
            ))}

            {todos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No tasks in this column.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <div className="border-t border-slate-200 p-1 ">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCreate(column.id)}
          className="w-full justify-start gap-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Plus className="h-3 w-3" />
          Create
        </Button>
      </div>

    </Card>
  )
}

export function DashboardBoard({
  todos,
  people,
  onStatusChange,
  onTodoUpdate,
  onCreate,
}: DashboardBoardProps) {
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
  const [commentAssets, setCommentAssets] = React.useState<
    Record<string, string[]>
  >({})
  const [commentThreads, setCommentThreads] = React.useState<
    Record<string, DashboardComment[]>
  >({})
  const [isLoadingComments, setIsLoadingComments] = React.useState(false)
  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentImageInputRef = React.useRef<HTMLInputElement | null>(null)
  const commentFileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (selectedTodo) {
      setDescriptionDraft(selectedTodo.description ?? "")
      setCommentDraft("")
      setIsEditingDescription(false)
      setIsEditingComments(openTarget === "comments")
      setEditingCommentId(null)
    }
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

  const formatCommentTime = React.useCallback((createdAt: string) => {
    const createdAtTime = new Date(createdAt).getTime()
    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - createdAtTime) / (1000 * 60))
    )

    if (minutesAgo < 1) {
      return "now"
    }

    if (minutesAgo === 1) {
      return "1 minute ago"
    }

    if (minutesAgo < 60) {
      return `${minutesAgo} minutes ago`
    }

    const hoursAgo = Math.floor(minutesAgo / 60)
    return hoursAgo === 1 ? "1 hour ago" : `${hoursAgo} hours ago`
  }, [])

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
                author: "Kerby Bryan Morte",
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
  }, [commentAssets, commentDraft, editingCommentId, onTodoUpdate, selectedTodo])

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
        const nextComments = currentComments.filter(
          (item) => item.id !== comment.id
        )

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

  return (
    <>
      <Carousel
        opts={{ align: "start" }}
        className="w-full px-6 md:hidden"
      >
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

      <Dialog
        open={selectedTodo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTodo(null)
            setOpenTarget("default")
            setIsEditingDescription(false)
            setIsEditingComments(false)
            setEditingCommentId(null)
          }
        }}
      >
        {selectedTodo ? (
          <DialogContent className="h-[92vh] max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-200 bg-white p-0 sm:h-[90vh] sm:max-h-[90vh] sm:w-[94vw] sm:max-w-[94vw] lg:h-[88vh] lg:max-h-[88vh] lg:w-[90vw] lg:max-w-[90vw]">
            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
              <div className="order-2 min-h-0 border-t border-slate-200 p-4 sm:p-5 lg:order-1 lg:border-t-0 lg:border-r lg:p-6">
                <ScrollArea className="h-full pr-2 sm:pr-3 lg:pr-4">
                  <DialogHeader className="mb-5 text-left sm:mb-6">
                    <DialogTitle className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                      {selectedTodo.title}
                    </DialogTitle>
    
                  </DialogHeader>

                  <div className="space-y-6">
                    <section className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Description
                      </h3>
                      {isEditingDescription ? (
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                            <button
                              type="button"
                              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                              onClick={() => imageInputRef.current?.click()}
                            >
                              <ImageIcon className="h-3 w-3" />
                              Image
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
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
                                handleAssetAttach(
                                  selectedTodo.id,
                                  event.target.files
                                )
                                event.target.value = ""
                              }}
                            />
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="hidden"
                              multiple
                              onChange={(event) => {
                                handleAssetAttach(
                                  selectedTodo.id,
                                  event.target.files
                                )
                                event.target.value = ""
                              }}
                            />
                          </div>

                          <Textarea
                            value={descriptionDraft}
                            onChange={(event) =>
                              setDescriptionDraft(event.target.value)
                            }
                            placeholder="Add a description..."
                            className="min-h-10 resize-none border-0 px-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 sm:min-h-12"
                          />

                          {(descriptionAssets[selectedTodo.id]?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(descriptionAssets[selectedTodo.id] ?? []).map(
                                (asset) => (
                                  <span
                                    key={asset}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                                  >
                                    <File className="h-3.5 w-3.5" />
                                    {asset}
                                  </span>
                                )
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-8 px-3"
                              onClick={handleDescriptionSave}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="min-h-8 px-3"
                              onClick={() => {
                                setDescriptionDraft(selectedTodo.description ?? "")
                                setIsEditingDescription(false)
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white sm:p-4"
                          onClick={() => setIsEditingDescription(true)}
                        >
                          {selectedTodo.description || "Add a description..."}
                        </button>
                      )}
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Linked work items
                      </h3>
                      <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 sm:p-4">
                        Add related tasks, links, or attachments here.
                      </div>
                    </section>

                  </div>
                </ScrollArea>
              </div>

              <aside className="order-1 min-h-0 p-4 sm:p-5 lg:order-2 lg:p-6">
                <ScrollArea className="h-full pr-2 sm:pr-3 lg:pr-4">
                  <div className="h-full">
                    <div className="flex h-full min-h-[550px] flex-col rounded-xl border border-slate-200 p-4">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">
                        Comments
                      </h3>
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        {isLoadingComments ? (
                          <p className="text-sm text-slate-500">
                            Loading comments...
                          </p>
                        ) : (commentThreads[selectedTodo.id] ?? []).length > 0 ? (
                          (commentThreads[selectedTodo.id] ?? []).map(
                            (comment) => (
                              <div key={comment.id} className="flex gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                                  KB
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {comment.author}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {formatCommentTime(comment.createdAt)}
                                      </p>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className="ml-auto rounded-sm p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                        >
                                          <Ellipsis className="h-4 w-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-32"
                                      >
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleEditComment(comment)
                                          }
                                        >
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onSelect={() =>
                                            void handleDeleteComment(comment)
                                          }
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  {comment.body ? (
                                    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-700">
                                      {comment.body.split(" ").map((part, index) =>
                                        part.startsWith("@") ? (
                                          <span
                                            key={`${comment.id}-mention-${index}`}
                                            className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                                          >
                                            {part}
                                          </span>
                                        ) : (
                                          <span key={`${comment.id}-text-${index}`}>
                                            {part}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  ) : null}
                                  {comment.attachments.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {comment.attachments.map((asset) => (
                                        <span
                                          key={`${comment.id}-${asset}`}
                                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                                        >
                                          <File className="h-3.5 w-3.5" />
                                          {asset}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div className="flex items-center gap-3 text-slate-500">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-xs transition hover:text-slate-700"
                                      onClick={() =>
                                        handleReplyToComment(comment.author)
                                      }
                                    >
                                      <Reply className="h-3.5 w-3.5" />
                                      <span>Reply</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-xs transition hover:text-slate-700"
                                    >
                                      <ThumbsUp className="h-3.5 w-3.5" />
                                      <span>Like</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-sm text-slate-500">
                            No comments yet.
                          </p>
                        )}
                      </div>

                      <div className="mt-auto pt-4 pb-3">
                      {isEditingComments ? (
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                            <button
                              type="button"
                              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                              onClick={() => commentImageInputRef.current?.click()}
                            >
                              <ImageIcon className="h-3 w-3" />
                              Image
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
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
                                handleCommentAssetAttach(
                                  selectedTodo.id,
                                  event.target.files
                                )
                                event.target.value = ""
                              }}
                            />
                            <input
                              ref={commentFileInputRef}
                              type="file"
                              className="hidden"
                              multiple
                              onChange={(event) => {
                                handleCommentAssetAttach(
                                  selectedTodo.id,
                                  event.target.files
                                )
                                event.target.value = ""
                              }}
                            />
                          </div>
                          <Textarea
                            value={commentDraft}
                            onChange={(event) =>
                              setCommentDraft(event.target.value)
                            }
                            placeholder="Add a comment..."
                            className="min-h-10 resize-none border-0 px-0 text-sm text-slate-700 shadow-none focus-visible:ring-0 sm:min-h-12"
                          />
                          {(commentAssets[selectedTodo.id]?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(commentAssets[selectedTodo.id] ?? []).map(
                                (asset) => (
                                  <span
                                    key={asset}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                                  >
                                    <File className="h-3.5 w-3.5" />
                                    {asset}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-8 px-3"
                              onClick={handleCommentSave}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="min-h-8 px-3"
                              onClick={() => {
                                setCommentDraft("")
                                if (selectedTodo) {
                                  setCommentAssets((current) => ({
                                    ...current,
                                    [selectedTodo.id]: [],
                                  }))
                                }
                                setEditingCommentId(null)
                                setIsEditingComments(false)
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-600 transition hover:border-slate-300 hover:bg-white"
                          onClick={() => setIsEditingComments(true)}
                        >
                          {commentDraft || "Add a comment..."}
                        </button>
                      )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </aside>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
