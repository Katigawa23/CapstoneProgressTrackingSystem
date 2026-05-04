"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  canCreateSprintForProject,
  cacheDashboardProjects,
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  type DashboardProject,
} from "@/lib/projects"
import { readClientAuthSession, subscribeToAuthChange, type AuthenticatedUser } from "@/lib/auth-client"
import { broadcastDashboardActivitySync } from "@/lib/dashboard-activity-sync"
import { writeDashboardBoardState } from "@/lib/dashboard-board-state"
import { DashboardBoard } from "../components/dashboard-board"
import {
  DashboardHeader,
  type DashboardBoardFilter,
} from "../components/dashboard-header"
import { CreateSprintDialog } from "../components/create-sprint-dialog"
import { CreateWorkItemDialog } from "../backlog/components/create-work-item-dialog"
import {
  buildAssigneeOptionId,
  createAssigneeOptionsFromProject,
  getAssigneeOption,
  setAssigneeOptions,
} from "../backlog/types"
import type { BacklogApiItem, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"

type DashboardBoardPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
  initialSprints: SprintSummary[]
  initialSprintId?: string | null
  breadcrumbSectionLabel?: string | null
  onProjectBoardSelectPath?: string
}

type SprintSummary = {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  backlogItemIds: string[]
}

function normalizeProjectPersonName(name: string) {
  return name
    .trim()
    .replace(/\s*\((student|faculty|adviser)\)\s*$/i, "")
    .replace(/\s+/g, " ")
}

function formatSprintCountdown(startDate: string, endDate: string) {
  const sprintStartDate = new Date(`${startDate}T00:00:00`)
  const dueDate = new Date(`${endDate}T23:59:59`)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const sprintStart = new Date(
    sprintStartDate.getFullYear(),
    sprintStartDate.getMonth(),
    sprintStartDate.getDate()
  )
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const millisecondsPerDay = 24 * 60 * 60 * 1000

  if (todayStart > dueStart) {
    const overdueDays =
      Math.floor((todayStart.getTime() - dueStart.getTime()) / millisecondsPerDay)

    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
  }

  const countdownStart = todayStart < sprintStart ? sprintStart : todayStart
  const differenceInDays =
    Math.floor((dueStart.getTime() - countdownStart.getTime()) / millisecondsPerDay) + 1

  if (differenceInDays === 0) {
    return "0 days remaining"
  }

  return `${differenceInDays} day${differenceInDays === 1 ? "" : "s"} remaining`
}

export function DashboardBoardPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
  initialSprints,
  initialSprintId = null,
  breadcrumbSectionLabel = null,
  onProjectBoardSelectPath = "/dashboard/board",
}: DashboardBoardPageClientProps) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    initialSelectedProjectId
  )
  const [todos, setTodos] = React.useState<TodoItem[]>([])
  const getCurrentProjectCode = React.useCallback((projectId?: string | null) => {
    const selectedProjectId = projectId ?? getSelectedDashboardProjectId()
    return getDashboardProjectCode(findDashboardProject(selectedProjectId))
  }, [])
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createTitle, setCreateTitle] = React.useState("")
  const [createTaskError, setCreateTaskError] = React.useState<string | null>(null)
  const [createStartDate, setCreateStartDate] = React.useState<Date | undefined>()
  const [createDueDate, setCreateDueDate] = React.useState<Date | undefined>()
  const [createDescription, setCreateDescription] = React.useState("")
  const [isCreatingTask, setIsCreatingTask] = React.useState(false)
  const [createSprintOpen, setCreateSprintOpen] = React.useState(false)
  const [sprintName, setSprintName] = React.useState("")
  const [createSprintError, setCreateSprintError] = React.useState<string | null>(null)
  const [sprintDuration, setSprintDuration] = React.useState("2-weeks")
  const [sprintStartDate, setSprintStartDate] = React.useState<Date | undefined>()
  const [sprintEndDate, setSprintEndDate] = React.useState<Date | undefined>()
  const [sprintScopeItemId, setSprintScopeItemId] = React.useState("")
  const [sprintDescription, setSprintDescription] = React.useState("")
  const [isCreatingSprint, setIsCreatingSprint] = React.useState(false)
  const [sprints, setSprints] = React.useState<SprintSummary[]>([])
  const [selectedSprintId, setSelectedSprintId] = React.useState<string | null>(initialSprintId)
  const [hasLoadedBoardData, setHasLoadedBoardData] = React.useState(false)
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValue, setFilterValue] =
    React.useState<DashboardBoardFilter>("none")
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [createSubtaskError, setCreateSubtaskError] = React.useState<string | null>(null)
  const selectedProject = React.useMemo(
    () =>
      initialProjects.find((project) => project.id === selectedProjectId) ??
      findDashboardProject(selectedProjectId) ??
      null,
    [initialProjects, selectedProjectId]
  )
  const selectedSprint = React.useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  )
  const canCreateSprint = React.useMemo(
    () => canCreateSprintForProject(selectedProject, currentUser),
    [currentUser, selectedProject]
  )
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

  const buildChecklist = React.useCallback((items: TodoItem[], parentId: string) => {
    const subtasks = items.filter((item) => item.parentId === parentId)
    const completedCount = subtasks.filter((item) => item.checked).length

    return `${completedCount}/${subtasks.length}`
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

  const fetchSprintsForProject = React.useCallback(async (projectId: string) => {
    const response = await fetch(`/api/sprints?projectId=${projectId}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Failed to load sprints")
    }

    const data = (await response.json()) as {
      sprints: SprintSummary[]
    }

    return data.sprints
  }, [])

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
    cacheDashboardProjects(initialProjects)
    setAssigneeOptions(
      createAssigneeOptionsFromProject(selectedProject, currentUser)
    )

    if (!initialSelectedProjectId) {
      return
    }

    setTodos(mapBacklogItemsToTodos(initialItems, getCurrentProjectCode(initialSelectedProjectId)))
    setSprints(initialSprints)
    setSelectedSprintId(initialSprintId)
    setHasLoadedBoardData(true)
  }, [
    currentUser,
    getCurrentProjectCode,
    initialItems,
    initialProjects,
    initialSprints,
    initialSelectedProjectId,
    initialSprintId,
    selectedProject,
  ])

  React.useEffect(() => {
    if (!hasLoadedBoardData) {
      return
    }

    writeDashboardBoardState({
      todoCount: todos.filter((todo) => todo.status === "todo").length,
      inprogressCount: todos.filter((todo) => todo.status === "inprogress").length,
      revisionCount: todos.filter((todo) => todo.status === "revision").length,
      completedCount: todos.filter((todo) => todo.status === "completed").length,
    })
  }, [hasLoadedBoardData, todos])

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
              remainingRootTodos.findIndex((todo) => todo.id === targetTodoId),
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
        broadcastDashboardActivitySync({
          itemId: todoId,
          assigneeId: currentTodo.assigneeId ?? null,
        })
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
    setCreateTaskError(null)
    setCreateStartDate(undefined)
    setCreateDueDate(undefined)
    setCreateDescription("")
  }

  const handleCreateItem = async () => {
    if (isCreatingTask || !createTitle.trim()) return

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
          assigneeId: null,
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

    async function loadTodosForSelectedProject() {
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

      try {
        const [mappedTodos, nextSprints] = await Promise.all([
          fetchTodosForProject(savedProjectId),
          fetchSprintsForProject(savedProjectId),
        ])

        if (!cancelled) {
          setTodos(mappedTodos)
          setSprints(nextSprints)
          setSelectedSprintId((currentSelectedSprintId) =>
            nextSprints.some((sprint) => sprint.id === currentSelectedSprintId)
              ? currentSelectedSprintId
              : null
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
    window.addEventListener(PROJECT_CHANGE_EVENT, loadTodosForSelectedProject)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, loadTodosForSelectedProject)
    }
  }, [currentUser, fetchSprintsForProject, fetchTodosForProject, initialProjects, router])

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

        const refreshedTodos = await fetchTodosForProject(selectedProjectId)
        setTodos(refreshedTodos)
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
    [fetchTodosForProject, isCreatingSubtask, router]
  )

  const filteredTodos = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    const sprintBacklogItemIds = new Set(selectedSprint?.backlogItemIds ?? [])
    const allSprintBacklogItemIds = new Set(
      sprints.flatMap((sprint) => sprint.backlogItemIds)
    )

    return todos.filter((todo) => {
      if (
        selectedSprint &&
        !sprintBacklogItemIds.has(todo.id) &&
        !(todo.parentId && sprintBacklogItemIds.has(todo.parentId))
      ) {
        return false
      }

      if (
        !selectedSprint &&
        (allSprintBacklogItemIds.has(todo.id) ||
          (todo.parentId ? allSprintBacklogItemIds.has(todo.parentId) : false))
      ) {
        return false
      }

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
  }, [currentUserAssigneeIds, filterValue, searchValue, selectedSprint, sprints, todos])

  const sprintScopeOptions = React.useMemo(
    () =>
      todos
        .filter((todo) => !todo.parentId)
        .map((todo) => ({
          id: todo.id,
          label: `${todo.displayId} - ${todo.title}`,
        })),
    [todos]
  )

  const resetCreateSprintForm = React.useCallback(() => {
    setSprintName("")
    setCreateSprintError(null)
    setSprintDuration("2-weeks")
    setSprintStartDate(undefined)
    setSprintEndDate(undefined)
    setSprintScopeItemId("")
    setSprintDescription("")
  }, [])

  const handleCreateSprint = React.useCallback(async () => {
    if (isCreatingSprint || !sprintName.trim() || !sprintStartDate || !sprintEndDate) {
      return
    }

    const activeProjectId = getSelectedDashboardProjectId()

    if (!activeProjectId) {
      router.replace("/dashboard")
      return
    }

    try {
      if (!canCreateSprint) {
        return
      }

      setIsCreatingSprint(true)
      const response = await fetch("/api/sprints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: activeProjectId,
          name: sprintName.trim(),
          duration: sprintDuration,
          startDate: sprintStartDate.toISOString().slice(0, 10),
          endDate: sprintEndDate.toISOString().slice(0, 10),
          description: sprintDescription.trim(),
          backlogItemIds: sprintScopeItemId ? [sprintScopeItemId] : [],
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to create sprint")
      }

      const data = (await response.json()) as {
        sprint: SprintSummary
      }

      setSprints((currentSprints) => [data.sprint, ...currentSprints])
      if (sprintScopeItemId) {
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === sprintScopeItemId
              ? { ...todo, status: "todo", checked: false }
              : todo
          )
        )
      }

      setCreateSprintOpen(false)
      resetCreateSprintForm()
      router.push(`/dashboard/active-sprint/${data.sprint.id}`)
    } catch (error) {
      setCreateSprintError(
        error instanceof Error ? error.message : "Failed to create sprint"
      )
    } finally {
      setIsCreatingSprint(false)
    }
  }, [
    isCreatingSprint,
    resetCreateSprintForm,
    router,
    sprintDescription,
    sprintDuration,
    sprintEndDate,
    sprintName,
    sprintScopeItemId,
    sprintStartDate,
    canCreateSprint,
  ])

  const handleAddToSprint = React.useCallback(
    async (todoId: string, sprintId: string) => {
      try {
        const response = await fetch(`/api/sprints/${sprintId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            backlogItemId: todoId,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to add work item to sprint")
        }

        setSprints((currentSprints) =>
          currentSprints.map((sprint) =>
            sprint.id === sprintId
              ? {
                  ...sprint,
                  backlogItemIds: sprint.backlogItemIds.includes(todoId)
                    ? sprint.backlogItemIds
                    : [...sprint.backlogItemIds.filter((id) => id !== todoId), todoId],
                }
              : {
                  ...sprint,
                  backlogItemIds: sprint.backlogItemIds.filter((id) => id !== todoId),
                }
          )
        )
        setTodos((currentTodos) =>
          currentTodos.map((todo) =>
            todo.id === todoId ? { ...todo, status: "todo", checked: false } : todo
          )
        )
      } catch (error) {
        console.error(error)
      }
    },
    []
  )

  const handleMoveToBoard = React.useCallback(
    async (todoId: string, sprintId: string) => {
      try {
        const response = await fetch(`/api/sprints/${sprintId}/items`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            backlogItemId: todoId,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to move work item to board")
        }

        setSprints((currentSprints) =>
          currentSprints.map((sprint) =>
            sprint.id === sprintId
              ? {
                  ...sprint,
                  backlogItemIds: sprint.backlogItemIds.filter((id) => id !== todoId),
                }
              : sprint
          )
        )
      } catch (error) {
        console.error(error)
      }
    },
    []
  )

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader
        people={projectPeople}
        breadcrumbSectionLabel={breadcrumbSectionLabel}
        activeSprintName={selectedSprint?.name ?? null}
        sprintDescription={selectedSprint?.description ?? null}
        sprintCountdownLabel={
          selectedSprint
            ? formatSprintCountdown(selectedSprint.startDate, selectedSprint.endDate)
            : null
        }
        boardTitle={selectedSprint ? "Sprint" : "Board"}
        showCreateButton={!selectedSprint}
        canCreateSprint={canCreateSprint}
        sprints={sprints}
        onProjectSelect={() => {
          router.push("/dashboard/board")
        }}
        onBreadcrumbSectionSelect={() => {
          if (!breadcrumbSectionLabel) {
            return
          }

          router.push(onProjectBoardSelectPath)
        }}
        onActiveSprintSelect={() => {
          if (!selectedSprint?.id) {
            return
          }

          router.push(`/dashboard/active-sprint/${selectedSprint.id}`)
        }}
        onSprintSelect={(sprintId) => {
          if (breadcrumbSectionLabel) {
            router.push(`/dashboard/active-sprint/${sprintId}`)
            return
          }

          setSelectedSprintId(sprintId)
        }}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        onCreate={() => {
          setCreateOpen(true)
        }}
        onCreateSprint={() => {
          if (!canCreateSprint) {
            return
          }

          setCreateSprintOpen(true)
        }}
        onManageSprints={() => {}}
      />
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-auto">
        <div className="min-h-0 w-full min-w-0 md:max-w-[calc(100vw-var(--sidebar-width)-3rem)] xl:max-w-[calc(100vw-var(--sidebar-width)-4rem)] 2xl:max-w-[calc(100vw-var(--sidebar-width)-5rem)]">
          <DashboardBoard
            todos={filteredTodos}
            isSprintView={Boolean(selectedSprint)}
            currentSprintId={selectedSprint?.id ?? null}
            sprints={sprints}
            onStatusChange={handleStatusChange}
            onMoveTodo={handleMoveTodo}
            onAssigneeChange={handleAssigneeChange}
            onAddToSprint={handleAddToSprint}
            onMoveToBoard={handleMoveToBoard}
            onTodoUpdate={handleTodoUpdate}
            onCreateSubtask={handleCreateSubtask}
            isCreatingSubtask={isCreatingSubtask}
            createSubtaskError={createSubtaskError}
            onCreateSubtaskInputChange={() => setCreateSubtaskError(null)}
            onUpdateSubtask={handleUpdateSubtask}
            onDeleteSubtask={handleDeleteSubtask}
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
        onTitleChange={(value) => {
          setCreateTaskError(null)
          setCreateTitle(value)
        }}
        onStartDateChange={setCreateStartDate}
        onDueDateChange={setCreateDueDate}
        onDescriptionChange={setCreateDescription}
        isSubmitting={isCreatingTask}
        onAddItem={handleCreateItem}
      />

      <CreateSprintDialog
        open={createSprintOpen}
        onOpenChange={(open) => {
          setCreateSprintOpen(open)
          if (!open) {
            resetCreateSprintForm()
          }
        }}
        sprintName={sprintName}
        sprintNameError={createSprintError}
        duration={sprintDuration}
        startDate={sprintStartDate}
        endDate={sprintEndDate}
        scopeItemId={sprintScopeItemId}
        description={sprintDescription}
        scopeOptions={sprintScopeOptions}
        onSprintNameChange={(value) => {
          setCreateSprintError(null)
          setSprintName(value)
        }}
        onDurationChange={setSprintDuration}
        onStartDateChange={setSprintStartDate}
        onEndDateChange={setSprintEndDate}
        onScopeItemChange={setSprintScopeItemId}
        onDescriptionChange={setSprintDescription}
        isSubmitting={isCreatingSprint}
        onCreateSprint={handleCreateSprint}
      />
    </div>
  )
}
