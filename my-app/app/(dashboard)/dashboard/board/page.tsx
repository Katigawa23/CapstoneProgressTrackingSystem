"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  findDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"
import { people } from "../constants"
import { DashboardBoard } from "../components/dashboard-board"
import { DashboardHeader } from "../components/dashboard-header"
import { CreateWorkItemDialog } from "../backlog/components/create-work-item-dialog"
import type { BacklogApiItem, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"
import type { UploadItem } from "../backlog/types"

export default function DashboardBoardPage() {
  const router = useRouter()
  const [todos, setTodos] = React.useState<TodoItem[]>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createTitle, setCreateTitle] = React.useState("")
  const [createDueDate, setCreateDueDate] = React.useState<Date | undefined>()
  const [createDescription, setCreateDescription] = React.useState("")
  const [createUploadedFile, setCreateUploadedFile] = React.useState<UploadItem | null>(null)

  const handleStatusChange = React.useCallback(
    (todoId: string, nextStatus: TodoItem["status"]) => {
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, status: nextStatus } : todo
        )
      )
    },
    []
  )

  const handleTodoUpdate = React.useCallback(
    (todoId: string, updates: Partial<TodoItem>) => {
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, ...updates } : todo
        )
      )
    },
    []
  )

  const handleCreateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const sizeInKb = file.size / 1024
    const formattedSize =
      sizeInKb < 1024
        ? `${sizeInKb.toFixed(1)} KB`
        : `${(sizeInKb / 1024).toFixed(1)} MB`

    setCreateUploadedFile({
      name: file.name,
      size: formattedSize,
      type: file.type || "File",
    })
  }

  const handleCreateRemoveFile = () => {
    setCreateUploadedFile(null)
  }

  const resetCreateForm = () => {
    setCreateTitle("")
    setCreateDueDate(undefined)
    setCreateDescription("")
    setCreateUploadedFile(null)
  }

  const handleCreateItem = async () => {
    if (!createTitle.trim()) return

    const selectedProjectId = getSelectedDashboardProjectId()

    if (!selectedProjectId) {
      router.replace("/dashboard")
      return
    }

    try {
      const response = await fetch("/api/backlog-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: createTitle.trim(),
          description: createDescription.trim(),
          dueDate: createDueDate ? createDueDate.toISOString().slice(0, 10) : null,
          file: createUploadedFile,
          assigneeId: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create backlog item")
      }

      const data = (await response.json()) as { item: BacklogApiItem }

      setTodos((prev) => [...prev, ...mapBacklogItemsToTodos([data.item])])
      resetCreateForm()
      setCreateOpen(false)
    } catch (error) {
      console.error(error)
    }
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadTodosForSelectedProject() {
      const savedProjectId = getSelectedDashboardProjectId()

      if (!savedProjectId || !findDashboardProject(savedProjectId)) {
        router.replace("/dashboard")
        return
      }

      try {
        const response = await fetch(`/api/backlog-items?projectId=${savedProjectId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load backlog items")
        }

        const data = (await response.json()) as { items: BacklogApiItem[] }

        if (!cancelled) {
          setTodos(mapBacklogItemsToTodos(data.items))
        }
      } catch (error) {
        console.error(error)
      }
    }

    void loadTodosForSelectedProject()
    window.addEventListener(PROJECT_CHANGE_EVENT, loadTodosForSelectedProject)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, loadTodosForSelectedProject)
    }
  }, [router])

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader people={people} />
      <DashboardBoard
        todos={todos}
        people={people}
        onStatusChange={handleStatusChange}
        onTodoUpdate={handleTodoUpdate}
        onCreate={() => setCreateOpen(true)}
      />

      <CreateWorkItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={createTitle}
        dueDate={createDueDate}
        description={createDescription}
        uploadedFile={createUploadedFile}
        onTitleChange={setCreateTitle}
        onDueDateChange={setCreateDueDate}
        onDescriptionChange={setCreateDescription}
        onFileChange={handleCreateFileChange}
        onRemoveFile={handleCreateRemoveFile}
        onAddItem={handleCreateItem}
      />
    </div>
  )
}
