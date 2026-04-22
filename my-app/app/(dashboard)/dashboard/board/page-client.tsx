"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  cacheDashboardProjects,
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  type DashboardProject,
} from "@/lib/projects"
import { people } from "../constants"
import { DashboardBoard } from "../components/dashboard-board"
import { DashboardHeader } from "../components/dashboard-header"
import { CreateWorkItemDialog } from "../backlog/components/create-work-item-dialog"
import { getAssigneeOption } from "../backlog/types"
import type { BacklogApiItem, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"

type DashboardBoardPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}

export function DashboardBoardPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
}: DashboardBoardPageClientProps) {
  const router = useRouter()
  const [todos, setTodos] = React.useState<TodoItem[]>([])
  const getCurrentProjectCode = React.useCallback((projectId?: string | null) => {
    const selectedProjectId = projectId ?? getSelectedDashboardProjectId()
    return getDashboardProjectCode(findDashboardProject(selectedProjectId))
  }, [])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createTitle, setCreateTitle] = React.useState("")
  const [createStartDate, setCreateStartDate] = React.useState<Date | undefined>()
  const [createDueDate, setCreateDueDate] = React.useState<Date | undefined>()
  const [createDescription, setCreateDescription] = React.useState("")

  const buildChecklist = React.useCallback((items: TodoItem[], parentId: string) => {
    const subtasks = items.filter((item) => item.parentId === parentId)
    const completedCount = subtasks.filter((item) => item.checked).length

    return `${completedCount}/${subtasks.length}`
  }, [])

  React.useEffect(() => {
    cacheDashboardProjects(initialProjects)

    if (!initialSelectedProjectId) {
      return
    }

    setTodos(mapBacklogItemsToTodos(initialItems, getCurrentProjectCode(initialSelectedProjectId)))
  }, [getCurrentProjectCode, initialItems, initialProjects, initialSelectedProjectId])

  const handleStatusChange = React.useCallback(
    async (todoId: string, nextStatus: TodoItem["status"]) => {
      const currentTodo = todos.find((todo) => todo.id === todoId)
      const nextChecked = nextStatus === "completed"

      if (!currentTodo || currentTodo.status === nextStatus) {
        return
      }

      setTodos((currentTodos) => {
        const nextTodos = currentTodos.map((todo) =>
          todo.id === todoId
            ? { ...todo, status: nextStatus, checked: nextChecked }
            : todo
        )

        if (!currentTodo.parentId) {
          return nextTodos
        }

        return nextTodos.map((todo) =>
          todo.id === currentTodo.parentId
            ? { ...todo, checklist: buildChecklist(nextTodos, currentTodo.parentId) }
            : todo
        )
      })

      try {
        const response = await fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus, checked: nextChecked }),
        })

        if (!response.ok) {
          throw new Error("Failed to update backlog item status")
        }
      } catch (error) {
        console.error(error)
        setTodos((currentTodos) => {
          const revertedTodos = currentTodos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  status: currentTodo.status,
                  checked: currentTodo.checked,
                }
              : todo
          )

          if (!currentTodo.parentId) {
            return revertedTodos
          }

          return revertedTodos.map((todo) =>
            todo.id === currentTodo.parentId
              ? { ...todo, checklist: buildChecklist(revertedTodos, currentTodo.parentId) }
              : todo
          )
        })
      }
    },
    [buildChecklist, todos]
  )

  const handleMoveTodo = React.useCallback(
    async (
      todoId: string,
      targetTodoId: string | null,
      nextStatus: TodoItem["status"]
    ) => {
      const previousTodos = todos
      const currentTodo = previousTodos.find((todo) => todo.id === todoId)

      if (!currentTodo) {
        return
      }

      const rootTodos = previousTodos.filter(
        (todo) => !todo.parentId
      )
      const nonRootTodos = previousTodos.filter(
        (todo) => Boolean(todo.parentId)
      )
      const remainingRootTodos = rootTodos.filter((todo) => todo.id !== todoId)
      const targetIndex =
        targetTodoId === null
          ? (() => {
              const lastMatchingIndex = remainingRootTodos.reduce(
                (lastIndex, todo, index) =>
                  todo.status === nextStatus ? index : lastIndex,
                -1
              )

              return lastMatchingIndex === -1
                ? remainingRootTodos.length
                : lastMatchingIndex + 1
            })()
          : Math.max(
              remainingRootTodos.findIndex((todo) => todo.id === targetTodoId) + 1,
              0
            )

      const movedTodo: TodoItem = {
        ...currentTodo,
        status: nextStatus,
        checked: nextStatus === "completed",
      }
      const reorderedRootTodos = [...remainingRootTodos]

      reorderedRootTodos.splice(targetIndex, 0, movedTodo)

      const normalizedRootTodos = reorderedRootTodos.map((todo, index) => ({
        ...todo,
        orderIndex: index + 1,
      }))
      const nextTodos = [...normalizedRootTodos, ...nonRootTodos]

      setTodos(nextTodos)

      try {
        await Promise.all(
          normalizedRootTodos.map((todo) =>
            fetch(`/api/backlog-items/${todo.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                status: todo.status,
                checked: todo.checked ?? false,
                orderIndex: todo.orderIndex,
              }),
            }).then((response) => {
              if (!response.ok) {
                throw new Error("Failed to reorder backlog item")
              }
            })
          )
        )
      } catch (error) {
        console.error(error)
        setTodos(previousTodos)
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

  const handleAssigneeChange = React.useCallback(
    async (todoId: string, assigneeId: string | null) => {
      const currentTodo = todos.find((todo) => todo.id === todoId)
      const nextAssignee = getAssigneeOption(assigneeId)

      if (!currentTodo || currentTodo.assigneeId === assigneeId) {
        return
      }

      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                assigneeId,
                assignee: nextAssignee?.name ?? "",
              }
            : todo
        )
      )

      try {
        const response = await fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assigneeId }),
        })

        if (!response.ok) {
          throw new Error("Failed to update backlog item assignee")
        }
      } catch (error) {
        console.error(error)
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === todoId
              ? {
                  ...todo,
                  assigneeId: currentTodo.assigneeId ?? null,
                  assignee: currentTodo.assignee,
                }
              : todo
          )
        )
      }
    },
    [todos]
  )

  const handleUpdateSubtask = React.useCallback(
    async (
      subtaskId: string,
      updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
    ) => {
      const currentSubtask = todos.find((todo) => todo.id === subtaskId)

      if (!currentSubtask) {
        return
      }

      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === subtaskId
            ? {
                ...todo,
                title: updates.title,
                description: updates.description,
                startDate: updates.startDate,
                deadline: updates.deadline,
              }
            : todo
        )
      )

      try {
        const response = await fetch(`/api/backlog-items/${subtaskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: updates.title,
            description: updates.description,
            startDate: updates.startDate || null,
            dueDate: updates.deadline || null,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update subtask")
        }
      } catch (error) {
        console.error(error)
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === subtaskId ? currentSubtask : todo
          )
        )
        throw error
      }
    },
    [todos]
  )

  const handleDeleteSubtask = React.useCallback(
    async (parentTodoId: string, subtaskId: string) => {
      const previousTodos = todos
      const nextTodos = todos.filter((todo) => todo.id !== subtaskId)

      setTodos(
        nextTodos.map((todo) =>
          todo.id === parentTodoId
            ? { ...todo, checklist: buildChecklist(nextTodos, parentTodoId) }
            : todo
        )
      )

      try {
        const response = await fetch(`/api/backlog-items/${subtaskId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete subtask")
        }
      } catch (error) {
        console.error(error)
        setTodos(previousTodos)
        throw error
      }
    },
    [buildChecklist, todos]
  )

  const resetCreateForm = () => {
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
          parentId: null,
          title: createTitle.trim(),
          description: createDescription.trim(),
          startDate: createStartDate ? createStartDate.toISOString().slice(0, 10) : null,
          dueDate: createDueDate ? createDueDate.toISOString().slice(0, 10) : null,
          status: "todo",
          assigneeId: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create backlog item")
      }

      const data = (await response.json()) as { item: BacklogApiItem }

      setTodos((prev) => [
        ...prev,
        ...mapBacklogItemsToTodos([data.item], getCurrentProjectCode(selectedProjectId)),
      ])
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

      if (savedProjectId === initialSelectedProjectId) {
        return
      }

      try {
        const response = await fetch(`/api/backlog-items?projectId=${savedProjectId}&limit=500`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load backlog items")
        }

        const data = (await response.json()) as { items: BacklogApiItem[] }

        if (!cancelled) {
          const mappedTodos = mapBacklogItemsToTodos(
            data.items,
            getCurrentProjectCode(savedProjectId)
          )
          setTodos(mappedTodos)
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
  }, [getCurrentProjectCode, initialSelectedProjectId, router])

  const handleCreateSubtask = React.useCallback(
    async (parentTodo: TodoItem, title: string, description: string) => {
      const selectedProjectId = getSelectedDashboardProjectId()

      if (!selectedProjectId) {
        router.replace("/dashboard")
        return
      }

      const response = await fetch("/api/backlog-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          parentId: parentTodo.id,
          title,
          description,
          startDate: null,
          dueDate: null,
          status: "todo",
          assigneeId: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create subtask")
      }

      const data = (await response.json()) as { item: BacklogApiItem }
      const [mappedSubtask] = mapBacklogItemsToTodos(
        [
          {
            ...data.item,
            parentId: data.item.parentId ?? parentTodo.id,
          },
        ],
        getCurrentProjectCode(selectedProjectId)
      )
      const siblingCount = todos.filter((todo) => todo.parentId === parentTodo.id).length
      const nextMappedSubtask = mappedSubtask
        ? {
            ...mappedSubtask,
            displayId: `${parentTodo.displayId} / ST-${siblingCount + 1}`,
          }
        : mappedSubtask

      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === parentTodo.id
            ? {
                ...todo,
                checklist: `${prev.filter((item) => item.parentId === parentTodo.id && item.checked).length}/${prev.filter((item) => item.parentId === parentTodo.id).length + 1}`,
              }
            : todo
        ).concat(nextMappedSubtask ?? [])
      )
    },
    [getCurrentProjectCode, router, todos]
  )

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader
        people={people}
        onCreate={() => {
          setCreateOpen(true)
        }}
      />
      <DashboardBoard
        todos={todos}
        people={people}
        onStatusChange={handleStatusChange}
        onMoveTodo={handleMoveTodo}
        onAssigneeChange={handleAssigneeChange}
        onTodoUpdate={handleTodoUpdate}
        onCreateSubtask={handleCreateSubtask}
        onUpdateSubtask={handleUpdateSubtask}
        onDeleteSubtask={handleDeleteSubtask}
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
