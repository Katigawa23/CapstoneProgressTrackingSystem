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
import { markDashboardBoardSeenInSession } from "@/lib/dashboard-first-open"
import { readClientAuthSession, subscribeToAuthChange, type AuthenticatedUser } from "@/lib/auth-client"
import {
  broadcastDashboardActivitySync,
  subscribeToDashboardActivitySync,
} from "@/lib/dashboard-activity-sync"
import { writeDashboardBoardState } from "@/lib/dashboard-board-state"
import {
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { DashboardBoard } from "../components/dashboard-board"
import {
  DashboardHeader,
  type DashboardBoardFilter,
} from "../components/dashboard-header"
import { BoardLoadingState } from "./board-loading-state"
import { CreateWorkItemDialog } from "../backlog/components/create-work-item-dialog"
import {
  buildAssigneeOptionId,
  createAssigneeOptionsFromProject,
  getAssigneeOption,
  setAssigneeOptions,
} from "../backlog/types"
import type { BacklogApiItem, TodoItem } from "../types"
import { buildSubtaskDisplayId, mapBacklogItemsToTodos } from "../utils"

type DashboardBoardPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
  breadcrumbSectionLabel?: string | null
  onProjectBoardSelectPath?: string
}

const BOARD_REALTIME_REFRESH_INTERVAL_MS = 5000
const BOARD_LOCAL_MUTATION_GUARD_MS = 8000
const BOARD_MOVE_SETTLE_MS = 1500

function normalizeProjectPersonName(name: string) {
  return name
    .trim()
    .replace(/\s*\((student|faculty|adviser)\)\s*$/i, "")
    .replace(/\s+/g, " ")
}

function areTodoListsEqual(left: TodoItem[], right: TodoItem[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((leftTodo, index) => {
    const rightTodo = right[index]

    return (
      rightTodo &&
      leftTodo.id === rightTodo.id &&
      leftTodo.displayId === rightTodo.displayId &&
      leftTodo.orderIndex === rightTodo.orderIndex &&
      leftTodo.parentId === rightTodo.parentId &&
      leftTodo.title === rightTodo.title &&
      leftTodo.description === rightTodo.description &&
      leftTodo.assignee === rightTodo.assignee &&
      leftTodo.assigneeId === rightTodo.assigneeId &&
      leftTodo.startDate === rightTodo.startDate &&
      leftTodo.deadline === rightTodo.deadline &&
      leftTodo.status === rightTodo.status &&
      leftTodo.checked === rightTodo.checked &&
      leftTodo.checklist === rightTodo.checklist &&
      leftTodo.comments === rightTodo.comments
    )
  })
}

export function DashboardBoardPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
  breadcrumbSectionLabel = null,
  onProjectBoardSelectPath = "/dashboard/board",
}: DashboardBoardPageClientProps) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    initialSelectedProjectId
  )
  const getCurrentProjectCode = React.useCallback((projectId?: string | null) => {
    const selectedProjectId = projectId ?? getSelectedDashboardProjectId()
    return getDashboardProjectCode(findDashboardProject(selectedProjectId))
  }, [])
  const [todos, setTodos] = React.useState<TodoItem[]>(() =>
    initialSelectedProjectId
      ? mapBacklogItemsToTodos(initialItems, getCurrentProjectCode(initialSelectedProjectId))
      : []
  )
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createTitle, setCreateTitle] = React.useState("")
  const [createTaskError, setCreateTaskError] = React.useState<string | null>(null)
  const [createStartDate, setCreateStartDate] = React.useState<Date | undefined>()
  const [createDueDate, setCreateDueDate] = React.useState<Date | undefined>()
  const [createDescription, setCreateDescription] = React.useState("")
  const [createAssigneeId, setCreateAssigneeId] = React.useState<string | null>(null)
  const [createPriority, setCreatePriority] =
    React.useState<"Low" | "Medium" | "High">("Medium")
  const [isCreatingTask, setIsCreatingTask] = React.useState(false)
  const [hasLoadedBoardData, setHasLoadedBoardData] = React.useState(
    () => Boolean(initialSelectedProjectId)
  )
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValue, setFilterValue] =
    React.useState<DashboardBoardFilter>("none")
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [createSubtaskError, setCreateSubtaskError] = React.useState<string | null>(null)
  const isMovingTodoRef = React.useRef(false)
  const localMutationGuardUntilRef = React.useRef(0)
  const localMutationReleaseTimerRef = React.useRef<number | null>(null)
  const isCoordinatorBoard = breadcrumbSectionLabel === "Coordinator"
  const selectedProject = React.useMemo(
    () =>
      initialProjects.find((project) => project.id === selectedProjectId) ??
      findDashboardProject(selectedProjectId) ??
      null,
    [initialProjects, selectedProjectId]
  )
  const canManageProjectResources =
    currentUser?.role === "faculty" || currentUser?.role === "admin"
  const projectPeople = React.useMemo(
    () => {
      const peopleByName = new Map<string, string>()

      for (const member of selectedProject?.members ?? []) {
        const cleanedMemberName = normalizeProjectPersonName(member)

        if (!cleanedMemberName) {
          continue
        }

        const normalizedMemberKey = cleanedMemberName.toLowerCase()

        if (!peopleByName.has(normalizedMemberKey)) {
          peopleByName.set(normalizedMemberKey, cleanedMemberName)
        }
      }

      if (currentUser?.name?.trim()) {
        const cleanedCurrentUserName = normalizeProjectPersonName(currentUser.name)

        if (cleanedCurrentUserName) {
          const normalizedCurrentUserKey = cleanedCurrentUserName.toLowerCase()

          if (!peopleByName.has(normalizedCurrentUserKey)) {
            peopleByName.set(normalizedCurrentUserKey, cleanedCurrentUserName)
          }
        }
      }

      return Array.from(peopleByName.values()).map((member) => ({ name: member, src: "" }))
    },
    [currentUser, selectedProject]
  )
  const currentUserAssigneeIds = React.useMemo(() => {
    const ids = new Set<string>()

    if (currentUser?.id?.trim()) {
      ids.add(currentUser.id.trim())
    }

    if (currentUser?.name?.trim()) {
      ids.add(buildAssigneeOptionId(currentUser.name))
    }

    return ids
  }, [currentUser])
  const creatorNamesById = React.useMemo(() => {
    const namesById: Record<string, string> = {}
    const memberUserIds = selectedProject?.memberUserIds ?? []
    const memberNames = selectedProject?.members ?? []

    memberUserIds.forEach((userId, index) => {
      const normalizedUserId = userId.trim()
      const normalizedName = memberNames[index]?.trim() ?? ""

      if (normalizedUserId && normalizedName) {
        namesById[normalizedUserId] = normalizedName
      }
    })

    if (currentUser?.id?.trim() && currentUser.name?.trim()) {
      namesById[currentUser.id.trim()] = currentUser.name.trim()
    }

    return namesById
  }, [currentUser, selectedProject])

  const buildChecklist = React.useCallback((items: TodoItem[], parentId: string) => {
    const subtasks = items.filter((item) => item.parentId === parentId)
    const completedCount = subtasks.filter((item) => item.checked).length

    return `${completedCount}/${subtasks.length}`
  }, [])
  const guardBoardSyncDuringLocalMutation = React.useCallback(() => {
    if (localMutationReleaseTimerRef.current) {
      window.clearTimeout(localMutationReleaseTimerRef.current)
      localMutationReleaseTimerRef.current = null
    }

    localMutationGuardUntilRef.current = Date.now() + BOARD_LOCAL_MUTATION_GUARD_MS
  }, [])
  const releaseBoardSyncGuardAfterSettle = React.useCallback(() => {
    if (localMutationReleaseTimerRef.current) {
      window.clearTimeout(localMutationReleaseTimerRef.current)
    }

    localMutationReleaseTimerRef.current = window.setTimeout(() => {
      localMutationGuardUntilRef.current = 0
      localMutationReleaseTimerRef.current = null
    }, BOARD_MOVE_SETTLE_MS)
  }, [])

  const fetchTodosForProject = React.useCallback(
    async (projectId: string) => {
      const response = await fetch(`/api/backlog-items?projectId=${projectId}&limit=500`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load backlog items")
      }

      const data = (await response.json()) as { items: BacklogApiItem[] }
      return mapBacklogItemsToTodos(
        data.items,
        getCurrentProjectCode(projectId)
      )
    },
    [getCurrentProjectCode]
  )

  React.useEffect(() => {
    const syncCurrentUser = () => {
      setCurrentUser(readClientAuthSession()?.user ?? null)
    }

    syncCurrentUser()
    const unsubscribe = subscribeToAuthChange(syncCurrentUser)

    return () => {
      unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (localMutationReleaseTimerRef.current) {
        window.clearTimeout(localMutationReleaseTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    cacheDashboardProjects(initialProjects)
    setAssigneeOptions(
      createAssigneeOptionsFromProject(selectedProject, currentUser)
    )

    if (!initialSelectedProjectId || hasLoadedBoardData) {
      return
    }

    setTodos(mapBacklogItemsToTodos(initialItems, getCurrentProjectCode(initialSelectedProjectId)))
    setHasLoadedBoardData(true)
  }, [
    currentUser,
    getCurrentProjectCode,
    initialItems,
    initialProjects,
    initialSelectedProjectId,
    selectedProject,
    hasLoadedBoardData,
  ])

  React.useEffect(() => {
    if (hasLoadedBoardData) {
      markDashboardBoardSeenInSession(selectedProjectId)
    }
  }, [hasLoadedBoardData, selectedProjectId])

  React.useEffect(() => {
    if (!hasLoadedBoardData) {
      return
    }

    const statusCounts = todos.reduce(
      (counts, todo) => {
        counts[todo.status] += 1
        return counts
      },
      {
        todo: 0,
        inprogress: 0,
        revision: 0,
        completed: 0,
      }
    )

    writeDashboardBoardState({
      todoCount: statusCounts.todo,
      inprogressCount: statusCounts.inprogress,
      revisionCount: statusCounts.revision,
      completedCount: statusCounts.completed,
    })
  }, [hasLoadedBoardData, todos])

  React.useEffect(() => {
    return subscribeToDashboardActivitySync((payload) => {
      if (
        typeof payload.status !== "string" &&
        typeof payload.checked !== "boolean" &&
        typeof payload.orderIndex !== "number" &&
        !("assigneeId" in payload)
      ) {
        return
      }

      setTodos((currentTodos) => {
        const currentTodo = currentTodos.find((todo) => todo.id === payload.itemId)

        if (!currentTodo) {
          return currentTodos
        }

        const nextTodos = currentTodos.map((todo) =>
          todo.id === payload.itemId
            ? {
                ...todo,
                ...("assigneeId" in payload
                  ? {
                      assigneeId: payload.assigneeId ?? null,
                      assignee: getAssigneeOption(payload.assigneeId ?? null)?.name ?? "",
                    }
                  : {}),
                ...(typeof payload.status === "string"
                  ? { status: payload.status }
                  : {}),
                ...(typeof payload.checked === "boolean"
                  ? { checked: payload.checked }
                  : {}),
                ...(typeof payload.orderIndex === "number"
                  ? { orderIndex: payload.orderIndex }
                  : {}),
              }
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
    })
  }, [buildChecklist])

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
      broadcastDashboardActivitySync({
        itemId: todoId,
        status: nextStatus,
        checked: nextChecked,
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
        broadcastDashboardActivitySync({
          itemId: todoId,
          status: currentTodo.status,
          checked: currentTodo.checked ?? false,
        })
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
      if (isCoordinatorBoard) {
        return
      }

      const previousTodos = todos
      const currentTodo = previousTodos.find((todo) => todo.id === todoId)

      if (!currentTodo || isMovingTodoRef.current) {
        return
      }

      isMovingTodoRef.current = true

      const sourceStatus = currentTodo.status
      const rootTodos = previousTodos.filter((todo) => !todo.parentId)
      const unchangedRootTodos = rootTodos.filter(
        (todo) =>
          todo.id !== todoId &&
          todo.status !== sourceStatus &&
          todo.status !== nextStatus
      )
      const sourceColumnTodos = rootTodos.filter(
        (todo) => todo.id !== todoId && todo.status === sourceStatus
      )
      const destinationColumnTodos =
        sourceStatus === nextStatus
          ? sourceColumnTodos
          : rootTodos.filter(
              (todo) => todo.id !== todoId && todo.status === nextStatus
            )
      const destinationIndex =
        targetTodoId === null
          ? destinationColumnTodos.length
          : Math.max(
              destinationColumnTodos.findIndex((todo) => todo.id === targetTodoId),
              0
            )
      const movedTodo: TodoItem = {
        ...currentTodo,
        status: nextStatus,
        checked: nextStatus === "completed",
      }
      const reorderedDestinationTodos = [...destinationColumnTodos]

      reorderedDestinationTodos.splice(destinationIndex, 0, movedTodo)

      const normalizedDestinationTodos = reorderedDestinationTodos.map((todo, index) => ({
        ...todo,
        orderIndex: index + 1,
      }))
      const normalizedSourceTodos =
        sourceStatus === nextStatus
          ? []
          : sourceColumnTodos.map((todo, index) => ({
              ...todo,
              orderIndex: index + 1,
            }))
      const changedRootTodos = [
        ...normalizedSourceTodos,
        ...normalizedDestinationTodos,
      ]
      const rootTodoById = new Map(rootTodos.map((todo) => [todo.id, todo]))
      const todosToPersist = changedRootTodos.filter((todo) => {
        const previousTodo = rootTodoById.get(todo.id)

        return (
          !previousTodo ||
          previousTodo.status !== todo.status ||
          Boolean(previousTodo.checked) !== Boolean(todo.checked) ||
          previousTodo.orderIndex !== todo.orderIndex
        )
      })
      const nonRootTodos = previousTodos.filter((todo) => Boolean(todo.parentId))
      const nextTodos = [
        ...unchangedRootTodos,
        ...changedRootTodos,
        ...nonRootTodos,
      ]

      guardBoardSyncDuringLocalMutation()
      setTodos(nextTodos)
      const normalizedMovedTodo =
        changedRootTodos.find((todo) => todo.id === movedTodo.id) ?? movedTodo
      broadcastDashboardActivitySync({
        itemId: normalizedMovedTodo.id,
        status: normalizedMovedTodo.status,
        checked: normalizedMovedTodo.checked ?? false,
        orderIndex: normalizedMovedTodo.orderIndex,
      })

      try {
        for (const todo of todosToPersist) {
          const response = await fetch(`/api/backlog-items/${todo.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              parentId: todo.parentId ?? null,
              status: todo.status,
              checked: todo.checked ?? false,
              orderIndex: todo.orderIndex,
            }),
          })

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null
            throw new Error(data?.error || "Failed to reorder backlog item")
          }
        }
      } catch (error) {
        console.error(error)
        broadcastDashboardActivitySync({
          itemId: currentTodo.id,
          status: currentTodo.status,
          checked: currentTodo.checked ?? false,
          orderIndex: currentTodo.orderIndex,
        })
        setTodos(previousTodos)
      } finally {
        isMovingTodoRef.current = false
        releaseBoardSyncGuardAfterSettle()
      }
    },
    [
      guardBoardSyncDuringLocalMutation,
      isCoordinatorBoard,
      releaseBoardSyncGuardAfterSettle,
      todos,
    ]
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
      broadcastDashboardActivitySync({ itemId: todoId, assigneeId })

      try {
        const response = await fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assigneeId,
            parentId: currentTodo.parentId ?? null,
          }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || "Failed to update backlog item assignee")
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
        broadcastDashboardActivitySync({
          itemId: todoId,
          assigneeId: currentTodo.assigneeId ?? null,
        })
      }
    },
    [todos]
  )

  const handlePriorityChange = React.useCallback(
    async (todoId: string, priority: TodoItem["priority"]) => {
      const currentTodo = todos.find((todo) => todo.id === todoId)

      if (!currentTodo || currentTodo.priority === priority) {
        return
      }

      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, priority } : todo
        )
      )

      try {
        const response = await fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            priority,
            parentId: currentTodo.parentId ?? null,
          }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || "Failed to update backlog item priority")
        }
      } catch (error) {
        console.error(error)
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === todoId ? { ...todo, priority: currentTodo.priority } : todo
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

  const handleArchiveTodo = React.useCallback(
    async (todo: TodoItem) => {
      const activeProjectId = getSelectedDashboardProjectId()

      if (!activeProjectId) {
        router.replace("/dashboard")
        return
      }

      const previousTodos = todos
      const nextTodos = todo.parentId
        ? todos.filter((item) => item.id !== todo.id)
        : todos.filter((item) => item.id !== todo.id && item.parentId !== todo.id)

      setTodos(() => {
        const baseTodos = nextTodos

        if (!todo.parentId) {
          return baseTodos
        }

        return baseTodos.map((item) =>
          item.id === todo.parentId
            ? { ...item, checklist: buildChecklist(baseTodos, todo.parentId) }
            : item
        )
      })

      try {
        const response = await fetch(`/api/backlog-items/${todo.id}/archive`, {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to archive item")
        }

        const refreshedTodos = await fetchTodosForProject(activeProjectId)
        setTodos(refreshedTodos)
      } catch (error) {
        console.error(error)
        setTodos(previousTodos)
        throw error
      }
    },
    [buildChecklist, fetchTodosForProject, router, todos]
  )

  const resetCreateForm = () => {
    setCreateTitle("")
    setCreateTaskError(null)
    setCreateStartDate(undefined)
    setCreateDueDate(undefined)
    setCreateDescription("")
    setCreateAssigneeId(null)
    setCreatePriority("Medium")
  }

  const handleCreateItem = async () => {
    if (isCreatingTask || !createTitle.trim()) return

    const titleValidationError = validateDisplayName(createTitle, "Task name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (titleValidationError) {
      setCreateTaskError(titleValidationError)
      return
    }

    const selectedProjectId = getSelectedDashboardProjectId()

    if (!selectedProjectId) {
      router.replace("/dashboard")
      return
    }

    try {
      setIsCreatingTask(true)
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
          assigneeId: createAssigneeId,
          priority: createPriority,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to create backlog item")
      }

      const data = (await response.json()) as { item: BacklogApiItem }

      setTodos((prev) => [
        ...prev,
        ...mapBacklogItemsToTodos([data.item], getCurrentProjectCode(selectedProjectId)),
      ])
      resetCreateForm()
      setCreateOpen(false)
    } catch (error) {
      setCreateTaskError(
        error instanceof Error ? error.message : "Failed to create backlog item"
      )
    } finally {
      setIsCreatingTask(false)
    }
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadTodosForSelectedProject(forceRefresh = false) {
      const savedProjectId = getSelectedDashboardProjectId()

      if (!savedProjectId || !findDashboardProject(savedProjectId)) {
        router.replace("/dashboard")
        return
      }

      setSelectedProjectId(savedProjectId)
      const nextProject =
        initialProjects.find((project) => project.id === savedProjectId) ?? null
      setAssigneeOptions(
        createAssigneeOptionsFromProject(nextProject, currentUser)
      )

      if (!forceRefresh && savedProjectId === initialSelectedProjectId) {
        return
      }

      try {
        const mappedTodos = await fetchTodosForProject(savedProjectId)

        if (!cancelled) {
          setTodos((currentTodos) =>
            areTodoListsEqual(currentTodos, mappedTodos) ? currentTodos : mappedTodos
          )
          setHasLoadedBoardData(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
        }
      }
    }

    void loadTodosForSelectedProject()
    const handleProjectChange = () => {
      void loadTodosForSelectedProject(true)
    }

    window.addEventListener(PROJECT_CHANGE_EVENT, handleProjectChange)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, handleProjectChange)
    }
  }, [
    currentUser,
    fetchTodosForProject,
    initialProjects,
    initialSelectedProjectId,
    router,
  ])

  React.useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    let cancelled = false
    let isSyncing = false

    const syncBoardData = async () => {
      if (
        cancelled ||
        isSyncing ||
        document.hidden ||
        Date.now() < localMutationGuardUntilRef.current
      ) {
        return
      }

      isSyncing = true

      try {
        const nextTodos = await fetchTodosForProject(selectedProjectId)

        if (cancelled || Date.now() < localMutationGuardUntilRef.current) {
          return
        }

        setTodos((currentTodos) =>
          areTodoListsEqual(currentTodos, nextTodos) ? currentTodos : nextTodos
        )
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync board data", error)
        }
      } finally {
        isSyncing = false
      }
    }

    const intervalId = window.setInterval(
      () => void syncBoardData(),
      BOARD_REALTIME_REFRESH_INTERVAL_MS
    )
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void syncBoardData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchTodosForProject, selectedProjectId])

  const handleCreateSubtask = React.useCallback(
    async (
      parentTodo: TodoItem,
      input: {
        title: string
        description: string
        startDate?: string
        dueDate?: string
      }
    ) => {
      if (isCreatingSubtask) {
        return
      }

      const titleValidationError = validateDisplayName(input.title, "Subtask name", {
        maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
      })

      if (titleValidationError) {
        setCreateSubtaskError(titleValidationError)
        throw new Error(titleValidationError)
      }

      const selectedProjectId = getSelectedDashboardProjectId()

      if (!selectedProjectId) {
        router.replace("/dashboard")
        return
      }

      try {
        setIsCreatingSubtask(true)
        setCreateSubtaskError(null)
        const response = await fetch(`/api/backlog-items/${parentTodo.id}/subtasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: selectedProjectId,
            title: input.title,
            description: input.description,
            startDate: input.startDate ?? null,
            dueDate: input.dueDate ?? null,
            status: "todo",
            assigneeId: null,
          }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || "Failed to create subtask")
        }

        const data = (await response.json()) as { item: BacklogApiItem }

        setTodos((currentTodos) => {
          const currentSiblingCount = currentTodos.filter(
            (todo) => todo.parentId === parentTodo.id
          ).length
          const createdSubtask: TodoItem = {
            id: data.item.id,
            displayId: buildSubtaskDisplayId(parentTodo.displayId, currentSiblingCount + 1),
            orderIndex: data.item.orderIndex,
            parentId: parentTodo.id,
            createdByUserId: data.item.createdByUserId ?? currentUser?.id ?? null,
            title: data.item.title,
            description: data.item.description,
            assignee: "",
            assigneeId: data.item.assigneeId ?? null,
            startDate: data.item.startDate ?? "",
            deadline: data.item.dueDate ?? "",
            status: data.item.status === "inprogress" || data.item.status === "revision" || data.item.status === "completed"
              ? data.item.status
              : "todo",
            checked: data.item.checked,
            comments: data.item.commentCount ?? 0,
            links: 0,
            checklist: "0/0",
            priority:
              data.item.status === "revision"
                ? "High"
                : data.item.status === "completed"
                ? "Low"
                : "Medium",
          }
          const nextTodos = [...currentTodos, createdSubtask]

          return nextTodos.map((todo) =>
            todo.id === parentTodo.id
              ? { ...todo, checklist: buildChecklist(nextTodos, parentTodo.id) }
              : todo
          )
        })
        setHasLoadedBoardData(true)
      } catch (error) {
        setCreateSubtaskError(
          error instanceof Error ? error.message : "Failed to create subtask"
        )
        throw error
      } finally {
        setIsCreatingSubtask(false)
      }
    },
    [buildChecklist, currentUser?.id, isCreatingSubtask, router]
  )

  const filteredTodos = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return todos.filter((todo) => {
      if (filterValue === "subtask" && !todo.parentId) {
        return false
      }

      if (
        filterValue === "assignee" &&
        (!todo.assigneeId || !currentUserAssigneeIds.has(todo.assigneeId))
      ) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableValues = [
        todo.title,
        todo.displayId,
        todo.description,
        todo.assignee,
      ]

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [currentUserAssigneeIds, filterValue, searchValue, todos])

  if (!hasLoadedBoardData) {
    return <BoardLoadingState />
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader
        people={projectPeople}
        breadcrumbSectionLabel={breadcrumbSectionLabel}
        boardTitle="Board"
        showCreateButton={Boolean(
          currentUser && currentUser.id !== "tester-coordinator"
        )}
        onProjectSelect={() => {
          router.push(onProjectBoardSelectPath)
        }}
        onBreadcrumbSectionSelect={() => {
          if (!breadcrumbSectionLabel) {
            return
          }

          router.push(onProjectBoardSelectPath)
        }}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        onCreate={() => {
          setCreateOpen(true)
        }}
      />
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-auto">
        <div className="min-h-0 w-full min-w-0 md:max-w-[calc(100vw-var(--sidebar-width)-3rem)] xl:max-w-[calc(100vw-var(--sidebar-width)-4rem)] 2xl:max-w-[calc(100vw-var(--sidebar-width)-5rem)]">
          <DashboardBoard
            todos={filteredTodos}
            currentUserId={currentUser?.id ?? null}
            creatorNamesById={creatorNamesById}
            canManageOtherProjectResources={canManageProjectResources}
            isDragDisabled={isCoordinatorBoard || currentUser?.id === "tester-coordinator"}
            onStatusChange={handleStatusChange}
            onMoveTodo={handleMoveTodo}
            onAssigneeChange={handleAssigneeChange}
            onPriorityChange={handlePriorityChange}
            onTodoUpdate={handleTodoUpdate}
            onCreateSubtask={handleCreateSubtask}
            isCreatingSubtask={isCreatingSubtask}
            createSubtaskError={createSubtaskError}
            onCreateSubtaskInputChange={() => setCreateSubtaskError(null)}
            onUpdateSubtask={handleUpdateSubtask}
            onArchiveTodo={handleArchiveTodo}
          />
        </div>
      </div>

      <CreateWorkItemDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            resetCreateForm()
          }
        }}
        title={createTitle}
        titleError={createTaskError}
        startDate={createStartDate}
        dueDate={createDueDate}
        description={createDescription}
        assigneeId={createAssigneeId}
        priority={createPriority}
        onTitleChange={(value) => {
          setCreateTaskError(null)
          setCreateTitle(value)
        }}
        onStartDateChange={setCreateStartDate}
        onDueDateChange={setCreateDueDate}
        onDescriptionChange={setCreateDescription}
        onAssigneeChange={setCreateAssigneeId}
        onPriorityChange={setCreatePriority}
        isSubmitting={isCreatingTask}
        onAddItem={handleCreateItem}
      />

    </div>
  )
}
