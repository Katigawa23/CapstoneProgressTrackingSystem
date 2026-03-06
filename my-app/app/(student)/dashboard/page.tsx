"use client"

import * as React from "react"

import { people } from "./constants"
import { DashboardBoard } from "./components/dashboard-board"
import { DashboardHeader } from "./components/dashboard-header"
import type { BacklogApiItem, TodoItem } from "./types"
import { mapBacklogItemsToTodos } from "./utils"

export default function DashboardPage() {
  const [todos, setTodos] = React.useState<TodoItem[]>([])

  React.useEffect(() => {
    let cancelled = false

    async function loadTodos() {
      try {
        const response = await fetch("/api/backlog-items", { cache: "no-store" })

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

    void loadTodos()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="w-full min-w-0 space-y-4">
      <DashboardHeader people={people} />
      <DashboardBoard todos={todos} people={people} />
    </div>
  )
}
