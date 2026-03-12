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
import type { BacklogApiItem, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"

export default function DashboardBoardPage() {
  const router = useRouter()
  const [todos, setTodos] = React.useState<TodoItem[]>([])

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
      />
    </div>
  )
}
