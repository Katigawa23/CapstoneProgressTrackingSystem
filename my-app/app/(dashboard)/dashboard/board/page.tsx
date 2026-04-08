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
import type { BacklogApiItem, ColumnId, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"

export default function DashboardBoardPage() {
  const router = useRouter()
  const [todos, setTodos] = React.useState<TodoItem[]>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createStatus, setCreateStatus] = React.useState<ColumnId>("todo")
  const [createTitle, setCreateTitle] = React.useState("")
  const [createStartDate, setCreateStartDate] = React.useState<Date | undefined>()
  const [createDueDate, setCreateDueDate] = React.useState<Date | undefined>()
  const [createDescription, setCreateDescription] = React.useState("")

  const handleStatusChange = React.useCallback(
    async (todoId: string, nextStatus: TodoItem["status"]) => {
      const currentTodo = todos.find((todo) => todo.id === todoId)

      if (!currentTodo || currentTodo.status === nextStatus) {
        return
      }

      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, status: nextStatus } : todo
        )
      )

      try {
        const response = await fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        })

        if (!response.ok) {
          throw new Error("Failed to update backlog item status")
        }
      } catch (error) {
        console.error(error)
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === todoId ? { ...todo, status: currentTodo.status } : todo
          )
        )
      }
    },
    [todos]
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

  const resetCreateForm = () => {
    setCreateStatus("todo")
    setCreateTitle("")
    setCreateStartDate(undefined)
    setCreateDueDate(undefined)
    setCreateDescription("")
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
          startDate: createStartDate ? createStartDate.toISOString().slice(0, 10) : null,
          dueDate: createDueDate ? createDueDate.toISOString().slice(0, 10) : null,
          status: createStatus,
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
        onCreate={(status) => {
          setCreateStatus(status)
          setCreateOpen(true)
        }}
      />

      <CreateWorkItemDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            resetCreateForm()
          }
        }}
        title={createTitle}
        startDate={createStartDate}
        dueDate={createDueDate}
        description={createDescription}
        onTitleChange={setCreateTitle}
        onStartDateChange={setCreateStartDate}
        onDueDateChange={setCreateDueDate}
        onDescriptionChange={setCreateDescription}
        onAddItem={handleCreateItem}
      />
    </div>
  )
}
