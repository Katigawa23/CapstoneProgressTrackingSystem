"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, type DropResult } from "@hello-pangea/dnd"

import type { BacklogApiItem, TodoItem } from "../types"
import { DashboardBoard } from "../components/dashboard-board"
import { BacklogBoard } from "./components/backlog-board"
import {
  BacklogToolbar,
  type BacklogSectionFilter,
} from "./components/backlog-toolbar"
import { BacklogLoadingSkeleton } from "./backlog-loading-skeleton"
import { CreateSprintDialog } from "../components/create-sprint-dialog"
import { CreateWorkItemDialog } from "./components/create-work-item-dialog"
import { EditWorkItemDialog } from "./components/edit-work-item-dialog"
import { statusOptions, type WorkItem } from "./types"
import {
  buildSubtaskDisplayId,
  buildTaskDisplayId,
  normalizeTaskDescription,
} from "../utils"
import {
  canCreateSprintForProject,
  cacheDashboardProjects,
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  type DashboardProject,
} from "@/lib/projects"
import {
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { readClientAuthSession, subscribeToAuthChange, type AuthenticatedUser } from "@/lib/auth-client"

function mapApiItems(items: BacklogApiItem[], projectCode: string): WorkItem[] {
  const normalizeParentId = (parentId?: string | null) => {
    if (typeof parentId !== "string") {
      return null
    }

    const trimmedParentId = parentId.trim()
    return trimmedParentId.length > 0 ? trimmedParentId : null
  }

  const childItemsByParentId = new Map<
    string,
    Array<BacklogApiItem & { parentId: string }>
  >()
  const rootDisplayIdById = new Map<string, string>()
  const childDisplayIndexById = new Map<string, number>()

  for (const item of items) {
    const normalizedParentId = normalizeParentId(item.parentId)

    if (!normalizedParentId) {
      rootDisplayIdById.set(
        item.id,
        buildTaskDisplayId(projectCode, item.sequenceNumber)
      )
      continue
    }

    const currentChildren = childItemsByParentId.get(normalizedParentId) ?? []
    currentChildren.push({
      ...item,
      parentId: normalizedParentId,
    })
    childItemsByParentId.set(normalizedParentId, currentChildren)
  }

  for (const childItems of childItemsByParentId.values()) {
    childItems.sort((left, right) => left.sequenceNumber - right.sequenceNumber)

    childItems.forEach((childItem, index) => {
      childDisplayIndexById.set(childItem.id, index + 1)
    })
  }

  return items.map((item) => {
    const normalizedParentId = normalizeParentId(item.parentId)
    const displayId = normalizedParentId
      ? (() => {
          const parentDisplayId =
            rootDisplayIdById.get(normalizedParentId) ??
            buildTaskDisplayId(projectCode, item.sequenceNumber)

          return buildSubtaskDisplayId(
            parentDisplayId,
            childDisplayIndexById.get(item.id) ?? 1
          )
        })()
      : rootDisplayIdById.get(item.id) ??
        buildTaskDisplayId(projectCode, item.sequenceNumber)

    return {
      id: item.id,
      displayId,
      orderIndex: item.orderIndex,
      parentId: normalizedParentId,
      title: item.title,
      description: normalizeTaskDescription(item.description),
      startDate: item.startDate ? new Date(item.startDate) : undefined,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      status: item.status,
      checked: item.checked,
      assigneeId: item.assigneeId ?? null,
    }
  })
}

type BacklogPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}

type SprintSummary = {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  backlogItemIds: string[]
}

export function BacklogPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
}: BacklogPageClientProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [createTaskError, setCreateTaskError] = React.useState<string | null>(null)
  const [startDate, setStartDate] = React.useState<Date | undefined>()
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [description, setDescription] = React.useState("")
  const [isCreatingTask, setIsCreatingTask] = React.useState(false)
  const [boardSearchValue, setBoardSearchValue] = React.useState("")
  const [boardFilterValue, setBoardFilterValue] =
    React.useState<BacklogSectionFilter>("none")
  const [sprintSearchValue, setSprintSearchValue] = React.useState("")
  const [sprintFilterValue, setSprintFilterValue] =
    React.useState<BacklogSectionFilter>("none")
  const [selectedSprintId, setSelectedSprintId] = React.useState<string | null>(null)
  const [createSprintOpen, setCreateSprintOpen] = React.useState(false)
  const [sprintName, setSprintName] = React.useState("")
  const [createSprintError, setCreateSprintError] = React.useState<string | null>(null)
  const [sprintDuration, setSprintDuration] = React.useState("2-weeks")
  const [sprintStartDate, setSprintStartDate] = React.useState<Date | undefined>()
  const [sprintEndDate, setSprintEndDate] = React.useState<Date | undefined>()
  const [sprintScopeItemId, setSprintScopeItemId] = React.useState("")
  const [sprintDescription, setSprintDescription] = React.useState("")
  const [isCreatingSprint, setIsCreatingSprint] = React.useState(false)
  const [selectedTaskDetailsId, setSelectedTaskDetailsId] = React.useState<string | null>(null)
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [createSubtaskError, setCreateSubtaskError] = React.useState<string | null>(null)

  const [items, setItems] = React.useState<WorkItem[]>([])
  const [sprints, setSprints] = React.useState<SprintSummary[]>([])
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const [isDragDropReady, setIsDragDropReady] = React.useState(false)

  const [editOpen, setEditOpen] = React.useState(false)
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editDescription, setEditDescription] = React.useState("")
  const [editStartDate, setEditStartDate] = React.useState<Date | undefined>()
  const [editDueDate, setEditDueDate] = React.useState<Date | undefined>()

  React.useEffect(() => {
    setIsDragDropReady(true)
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

    if (!initialSelectedProjectId) {
      return
    }

    const selectedProject = initialProjects.find((project) => project.id === initialSelectedProjectId)

    if (!selectedProject) {
      return
    }

    const projectCode = getDashboardProjectCode(selectedProject)
    setItems(mapApiItems(initialItems, projectCode))
  }, [initialItems, initialProjects, initialSelectedProjectId])

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
    let cancelled = false

    async function loadInitialSprints() {
      if (!initialSelectedProjectId) {
        setSprints([])
        return
      }

      try {
        const nextSprints = await fetchSprintsForProject(initialSelectedProjectId)

        if (!cancelled) {
          setSprints(nextSprints)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
        }
      }
    }

    void loadInitialSprints()

    return () => {
      cancelled = true
    }
  }, [fetchSprintsForProject, initialSelectedProjectId])

  const orderedItems = React.useMemo(() => {
    const sortedItems = [...items].sort(
      (left, right) => left.orderIndex - right.orderIndex
    )
    const childItemsByParentId = new Map<string, WorkItem[]>()

    for (const item of sortedItems) {
      if (!item.parentId) {
        continue
      }

      const currentChildren = childItemsByParentId.get(item.parentId) ?? []
      currentChildren.push(item)
      childItemsByParentId.set(item.parentId, currentChildren)
    }

    const ordered: WorkItem[] = []

    const appendItemTree = (item: WorkItem) => {
      ordered.push(item)

      const childItems = childItemsByParentId.get(item.id) ?? []

      for (const childItem of childItems) {
        appendItemTree(childItem)
      }
    }

    for (const item of sortedItems) {
      if (item.parentId) {
        continue
      }

      appendItemTree(item)
    }

    return ordered
  }, [items])

  React.useEffect(() => {
    let cancelled = false

    async function loadItems() {
      const selectedProjectId = getSelectedDashboardProjectId()
      const selectedProject = findDashboardProject(selectedProjectId)

      if (!selectedProjectId || !selectedProject) {
        router.replace("/dashboard")
        return
      }

      if (selectedProjectId === initialSelectedProjectId) {
        return
      }

      try {
        const [itemsResponse, nextSprints] = await Promise.all([
          fetch(`/api/backlog-items?projectId=${selectedProjectId}&limit=500`, {
            cache: "no-store",
          }),
          fetchSprintsForProject(selectedProjectId),
        ])

        if (!itemsResponse.ok) {
          throw new Error("Failed to load backlog items")
        }

        const data = (await itemsResponse.json()) as { items: BacklogApiItem[] }
        const projectCode = getDashboardProjectCode(selectedProject)

        if (!cancelled) {
          setItems(mapApiItems(data.items, projectCode))
          setSprints(nextSprints)
        }
      } catch (error) {
        console.error(error)
      }
    }

    void loadItems()
    window.addEventListener(PROJECT_CHANGE_EVENT, loadItems)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, loadItems)
    }
  }, [fetchSprintsForProject, initialSelectedProjectId, router])

  const sprintBacklogItemIds = React.useMemo(
    () => new Set(sprints.flatMap((sprint) => sprint.backlogItemIds)),
    [sprints]
  )

  const resetForm = () => {
    setTitle("")
    setCreateTaskError(null)
    setStartDate(undefined)
    setDueDate(undefined)
    setDescription("")
  }

  const resetCreateSprintForm = React.useCallback(() => {
    setSprintName("")
    setCreateSprintError(null)
    setSprintDuration("2-weeks")
    setSprintStartDate(undefined)
    setSprintEndDate(undefined)
    setSprintScopeItemId("")
    setSprintDescription("")
  }, [])

  const handleAddItem = async () => {
    if (isCreatingTask || !title.trim()) return

    const selectedProjectId = getSelectedDashboardProjectId()
    const selectedProject = findDashboardProject(selectedProjectId)

    if (!selectedProjectId || !selectedProject) {
      router.replace("/dashboard")
      return
    }

    const titleValidationError = validateDisplayName(title, "Task name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (titleValidationError) {
      setCreateTaskError(titleValidationError)
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
          title: title.trim(),
          description: description.trim(),
          startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
          dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
          assigneeId: null,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to create backlog item")
      }

      const data = (await response.json()) as { item: BacklogApiItem }
      const projectCode = getDashboardProjectCode(selectedProject)

      setItems((prev) => [...mapApiItems([data.item], projectCode), ...prev])
      resetForm()
      setOpen(false)
    } catch (error) {
      setCreateTaskError(
        error instanceof Error ? error.message : "Failed to create backlog item"
      )
    } finally {
      setIsCreatingTask(false)
    }
  }

  const updateItemStatus = async (id: string, nextStatus: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
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
    }
  }

  const toggleCheckbox = async (id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ checked }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item checkbox")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const updateItemAssignee = async (id: string, assigneeId: string | null) => {
    const currentItem = items.find((item) => item.id === id)

    if (!currentItem) {
      return
    }

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, assigneeId } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assigneeId,
          parentId: currentItem.parentId ?? null,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to update backlog item assignee")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleOpenEdit = (item: WorkItem) => {
    setEditingItemId(item.id)
    setEditTitle(item.title)
    setEditDescription(item.description)
    setEditStartDate(item.startDate)
    setEditDueDate(item.dueDate)
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItemId || !editTitle.trim()) return

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              title: editTitle.trim(),
              description: editDescription.trim(),
              startDate: editStartDate,
              dueDate: editDueDate,
            }
          : item
      )
    )

    try {
      const response = await fetch(`/api/backlog-items/${editingItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          startDate: editStartDate ? editStartDate.toISOString().slice(0, 10) : null,
          dueDate: editDueDate ? editDueDate.toISOString().slice(0, 10) : null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item")
      }

      setEditOpen(false)
      setEditingItemId(null)
      setEditTitle("")
      setEditDescription("")
      setEditStartDate(undefined)
      setEditDueDate(undefined)
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteItem = async (id: string) => {
    const previousItems = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete backlog item")
      }
    } catch (error) {
      console.error(error)
      setItems(previousItems)
    }
  }

  const handleArchiveDetailsTodo = React.useCallback(
    async (todo: TodoItem) => {
      const previousItems = items
      const nextItems = todo.parentId
        ? items.filter((item) => item.id !== todo.id)
        : items.filter((item) => item.id !== todo.id && item.parentId !== todo.id)

      setItems(nextItems)

      try {
        const response = await fetch(`/api/backlog-items/${todo.id}/archive`, {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to archive item")
        }
      } catch (error) {
        console.error(error)
        setItems(previousItems)
        throw error
      }
    },
    [items]
  )

  const boardItems = React.useMemo(
    () =>
      orderedItems.filter(
        (item) =>
          !sprintBacklogItemIds.has(item.id) &&
          !(item.parentId && sprintBacklogItemIds.has(item.parentId))
      ),
    [orderedItems, sprintBacklogItemIds]
  )

  const sprintItems = React.useMemo(
    () =>
      orderedItems.filter(
        (item) =>
          sprintBacklogItemIds.has(item.id) ||
          (item.parentId ? sprintBacklogItemIds.has(item.parentId) : false)
      ),
    [orderedItems, sprintBacklogItemIds]
  )

  const selectedSprintBacklogItemIds = React.useMemo(() => {
    if (!selectedSprintId) {
      return null
    }

    const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId)
    return selectedSprint ? new Set(selectedSprint.backlogItemIds) : null
  }, [selectedSprintId, sprints])

  const selectedSprint = React.useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  )
  const selectedProject = React.useMemo(() => {
    const selectedProjectId = getSelectedDashboardProjectId() ?? initialSelectedProjectId

    return (
      initialProjects.find((project) => project.id === selectedProjectId) ??
      findDashboardProject(selectedProjectId) ??
      null
    )
  }, [initialProjects, initialSelectedProjectId])
  const canCreateSprint = React.useMemo(
    () => canCreateSprintForProject(selectedProject, currentUser),
    [currentUser, selectedProject]
  )

  const scopedSprintItems = React.useMemo(() => {
    if (!selectedSprintBacklogItemIds) {
      return []
    }

    return sprintItems.filter(
      (item) =>
        selectedSprintBacklogItemIds.has(item.id) ||
        (item.parentId ? selectedSprintBacklogItemIds.has(item.parentId) : false)
    )
  }, [selectedSprintBacklogItemIds, sprintItems])

  const sprintScopeOptions = React.useMemo(
    () =>
      boardItems
        .filter((item) => !item.parentId)
        .map((item) => ({
          id: item.id,
          label: `${item.displayId} - ${item.title}`,
        })),
    [boardItems]
  )

  const formatTaskDate = React.useCallback((date?: Date) => {
    return date ? date.toISOString().slice(0, 10) : ""
  }, [])

  const buildChecklist = React.useCallback((sourceItems: WorkItem[], parentId: string) => {
    const childItems = sourceItems.filter((item) => item.parentId === parentId)
    const completedItems = childItems.filter((item) => item.status === "completed").length

    return `${completedItems}/${childItems.length}`
  }, [])

  const detailTodos = React.useMemo<TodoItem[]>(
    () =>
      orderedItems.map((item) => ({
        id: item.id,
        displayId: item.displayId,
        orderIndex: item.orderIndex,
        parentId: item.parentId ?? null,
        title: item.title,
        description: item.description,
        assignee: "",
        assigneeId: item.assigneeId ?? null,
        startDate: formatTaskDate(item.startDate),
        deadline: formatTaskDate(item.dueDate),
        status:
          item.status === "inprogress" ||
          item.status === "revision" ||
          item.status === "completed"
            ? item.status
            : "todo",
        checked: item.checked,
        comments: 0,
        links: 0,
        checklist: buildChecklist(orderedItems, item.id),
        priority:
          item.status === "revision"
            ? "High"
            : item.status === "completed"
            ? "Low"
            : "Medium",
      })),
    [buildChecklist, formatTaskDate, orderedItems]
  )

  const filterSectionItems = React.useCallback(
    (
      sectionItems: WorkItem[],
      searchValue: string,
      filterValue: BacklogSectionFilter
    ) => {
      const normalizedSearch = searchValue.trim().toLowerCase()
      const currentUserId = currentUser?.id?.trim() ?? ""

      return sectionItems.filter((item) => {
        if (filterValue === "assignee" && (!currentUserId || item.assigneeId !== currentUserId)) {
          return false
        }

        if (
          filterValue !== "none" &&
          filterValue !== "assignee" &&
          item.status !== filterValue
        ) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        return [item.title, item.displayId, item.description].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      })
    },
    [currentUser]
  )

  const handleTaskDetailsUpdate = React.useCallback(
    (todoId: string, updates: Partial<TodoItem>) => {
      const itemUpdates: Partial<WorkItem> = {}
      const patchPayload: Record<string, string | null> = {}

      if (typeof updates.title === "string") {
        itemUpdates.title = updates.title
        patchPayload.title = updates.title
      }

      if (typeof updates.description === "string") {
        itemUpdates.description = updates.description
        patchPayload.description = updates.description
      }

      if (typeof updates.startDate === "string") {
        itemUpdates.startDate = updates.startDate ? new Date(updates.startDate) : undefined
        patchPayload.startDate = updates.startDate || null
      }

      if (typeof updates.deadline === "string") {
        itemUpdates.dueDate = updates.deadline ? new Date(updates.deadline) : undefined
        patchPayload.dueDate = updates.deadline || null
      }

      if (updates.assigneeId !== undefined) {
        itemUpdates.assigneeId = updates.assigneeId ?? null
      }

      if (updates.checked !== undefined) {
        itemUpdates.checked = Boolean(updates.checked)
      }

      if (updates.status) {
        itemUpdates.status = updates.status
      }

      if (Object.keys(itemUpdates).length > 0) {
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === todoId ? { ...item, ...itemUpdates } : item
          )
        )
      }

      if (Object.keys(patchPayload).length > 0) {
        void fetch(`/api/backlog-items/${todoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchPayload),
        }).catch((error) => console.error(error))
      }
    },
    []
  )

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

        const data = (await response.json()) as { item: BacklogApiItem }
        const siblingCount = items.filter((item) => item.parentId === parentTodo.id).length

        setItems((currentItems) => [
          ...currentItems,
          {
            id: data.item.id,
            displayId: buildSubtaskDisplayId(parentTodo.displayId, siblingCount + 1),
            orderIndex: data.item.orderIndex,
            parentId: parentTodo.id,
            title: data.item.title,
            description: data.item.description,
            startDate: data.item.startDate ? new Date(data.item.startDate) : undefined,
            dueDate: data.item.dueDate ? new Date(data.item.dueDate) : undefined,
            status: data.item.status,
            checked: data.item.checked,
            assigneeId: data.item.assigneeId ?? null,
          },
        ])
      } catch (error) {
        setCreateSubtaskError(
          error instanceof Error ? error.message : "Failed to create subtask"
        )
        throw error
      } finally {
        setIsCreatingSubtask(false)
      }
    },
    [isCreatingSubtask, items, router]
  )

  const handleUpdateSubtask = React.useCallback(
    async (
      subtaskId: string,
      updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
    ) => {
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === subtaskId
            ? {
                ...item,
                title: updates.title,
                description: updates.description,
                startDate: updates.startDate ? new Date(updates.startDate) : undefined,
                dueDate: updates.deadline ? new Date(updates.deadline) : undefined,
              }
            : item
        )
      )

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
    },
    []
  )

  const filteredBoardItems = React.useMemo(
    () => filterSectionItems(boardItems, boardSearchValue, boardFilterValue),
    [boardFilterValue, boardItems, boardSearchValue, filterSectionItems]
  )

  const filteredSprintItems = React.useMemo(
    () => filterSectionItems(scopedSprintItems, sprintSearchValue, sprintFilterValue),
    [filterSectionItems, scopedSprintItems, sprintFilterValue, sprintSearchValue]
  )

  const reorderRootItems = React.useCallback(
    async (orderedVisibleItems: WorkItem[], draggedItemId: string, targetItemId: string | null) => {
      const allRootItems = items
        .filter((item) => !item.parentId)
        .sort((left, right) => left.orderIndex - right.orderIndex)
      const visibleRootIds = orderedVisibleItems
        .filter((item) => !item.parentId)
        .map((item) => item.id)

      if (!visibleRootIds.includes(draggedItemId)) {
        return
      }

      const currentVisibleRoots = allRootItems.filter((item) =>
        visibleRootIds.includes(item.id)
      )
      const movedRoot = currentVisibleRoots.find((item) => item.id === draggedItemId)

      if (!movedRoot) {
        return
      }

      const reorderedVisibleRoots = currentVisibleRoots.filter(
        (item) => item.id !== draggedItemId
      )
      const destinationIndex =
        targetItemId === null
          ? reorderedVisibleRoots.length
          : Math.max(
              reorderedVisibleRoots.findIndex((item) => item.id === targetItemId),
              0
            )

      reorderedVisibleRoots.splice(destinationIndex, 0, movedRoot)

      let visibleIndex = 0
      const nextRootItems = allRootItems.map((item) =>
        visibleRootIds.includes(item.id)
          ? reorderedVisibleRoots[visibleIndex++] ?? item
          : item
      )

      const nextOrderIndexById = new Map(
        nextRootItems.map((item, index) => [item.id, index + 1])
      )
      const previousItems = items
      const nextItems = items.map((item) =>
        item.parentId
          ? item
          : {
              ...item,
              orderIndex: nextOrderIndexById.get(item.id) ?? item.orderIndex,
            }
      )

      setItems(nextItems)

      try {
        await Promise.all(
          nextRootItems.map((item, index) =>
            fetch(`/api/backlog-items/${item.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ orderIndex: index + 1 }),
            }).then((response) => {
              if (!response.ok) {
                throw new Error("Failed to reorder backlog item")
              }
            })
          )
        )
      } catch (error) {
        console.error(error)
        setItems(previousItems)
      }
    },
    [items]
  )

  const buildStatusCounts = React.useCallback(
    (sectionItems: WorkItem[]) => {
      const countsByStatus = sectionItems.reduce<Record<string, number>>(
        (counts, item) => {
          counts[item.status] = (counts[item.status] ?? 0) + 1
          return counts
        },
        {}
      )

      return statusOptions.map((status) => ({
        ...status,
        count: countsByStatus[status.value] ?? 0,
      }))
    },
    []
  )

  const toggleSectionCheckboxes = React.useCallback(
    async (sectionItems: WorkItem[], checked: boolean) => {
      const previousItems = items
      const itemIds = sectionItems.map((item) => item.id)

      if (itemIds.length === 0) {
        return
      }

      setItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? { ...item, checked } : item
        )
      )

      try {
        await Promise.all(
          itemIds.map(async (id) => {
            const response = await fetch(`/api/backlog-items/${id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ checked }),
            })

            if (!response.ok) {
              throw new Error("Failed to update backlog item checkbox")
            }
          })
        )
      } catch (error) {
        console.error(error)
        setItems(previousItems)
      }
    },
    [items]
  )

  const moveItemToSprint = React.useCallback(
    async (backlogItemId: string, sprintId: string) => {
      if (!canCreateSprint) {
        return
      }

      const previousSprints = sprints
      const previousItems = items

      setSprints((currentSprints) =>
        currentSprints.map((sprint) =>
          sprint.id === sprintId
            ? {
                ...sprint,
                backlogItemIds: sprint.backlogItemIds.includes(backlogItemId)
                  ? sprint.backlogItemIds
                  : [...sprint.backlogItemIds.filter((id) => id !== backlogItemId), backlogItemId],
              }
            : {
                ...sprint,
                backlogItemIds: sprint.backlogItemIds.filter((id) => id !== backlogItemId),
              }
        )
      )
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === backlogItemId ? { ...item, status: "todo", checked: false } : item
        )
      )

      try {
        const response = await fetch(`/api/sprints/${sprintId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ backlogItemId }),
        })

        if (!response.ok) {
          throw new Error("Failed to add work item to sprint")
        }
      } catch (error) {
        console.error(error)
        setSprints(previousSprints)
        setItems(previousItems)
      }
    },
    [canCreateSprint, items, sprints]
  )

  const moveItemToBoard = React.useCallback(
    async (backlogItemId: string, sprintId: string) => {
      if (!canCreateSprint) {
        return
      }

      const previousSprints = sprints

      setSprints((currentSprints) =>
        currentSprints.map((sprint) =>
          sprint.id === sprintId
            ? {
                ...sprint,
                backlogItemIds: sprint.backlogItemIds.filter((id) => id !== backlogItemId),
              }
            : sprint
        )
      )

      try {
        const response = await fetch(`/api/sprints/${sprintId}/items`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ backlogItemId }),
        })

        if (!response.ok) {
          throw new Error("Failed to remove work item from sprint")
        }
      } catch (error) {
        console.error(error)
        setSprints(previousSprints)
      }
    },
    [canCreateSprint, sprints]
  )

  const getRootItemsForDroppable = React.useCallback(
    (droppableId: string) => {
      if (droppableId === "backlog-board") {
        return filteredBoardItems.filter((item) => !item.parentId)
      }

      if (droppableId === "backlog-sprint") {
        return filteredSprintItems.filter((item) => !item.parentId)
      }

      return []
    },
    [filteredBoardItems, filteredSprintItems]
  )

  const handleBacklogDragEnd = React.useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result

      if (!canCreateSprint || !destination) {
        return
      }

      const samePosition =
        source.droppableId === destination.droppableId &&
        source.index === destination.index

      if (samePosition) {
        return
      }

      if (
        source.droppableId === "backlog-board" &&
        destination.droppableId === "backlog-sprint"
      ) {
        if (!selectedSprintId) {
          return
        }

        void moveItemToSprint(draggableId, selectedSprintId)
        return
      }

      if (
        source.droppableId === "backlog-sprint" &&
        destination.droppableId === "backlog-board"
      ) {
        if (!selectedSprintId) {
          return
        }

        void moveItemToBoard(draggableId, selectedSprintId)
        return
      }

      if (source.droppableId === destination.droppableId) {
        const rootItems = getRootItemsForDroppable(destination.droppableId)
        const reorderedRootItems = rootItems.filter((item) => item.id !== draggableId)
        const targetItem = reorderedRootItems[destination.index] ?? null

        void reorderRootItems(rootItems, draggableId, targetItem?.id ?? null)
      }
    },
    [canCreateSprint, getRootItemsForDroppable, moveItemToBoard, moveItemToSprint, reorderRootItems, selectedSprintId]
  )

  const handleCreateSprint = React.useCallback(async () => {
    if (isCreatingSprint || !sprintName.trim() || !sprintStartDate || !sprintEndDate) {
      return
    }

    const nameValidationError = validateDisplayName(sprintName, "Sprint name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (nameValidationError) {
      setCreateSprintError(nameValidationError)
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
        setItems((currentItems) =>
          currentItems.map((item) =>
            item.id === sprintScopeItemId
              ? { ...item, status: "todo", checked: false }
              : item
          )
        )
      }

      setCreateSprintOpen(false)
      resetCreateSprintForm()
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        {!isDragDropReady ? (
          <BacklogLoadingSkeleton />
        ) : (
        <DragDropContext onDragEnd={handleBacklogDragEnd}>
        <div className="space-y-6 pb-6">
          <BacklogToolbar
            title="Backlog"
            searchPlaceholder="Search backlog..."
            searchValue={boardSearchValue}
            onSearchChange={setBoardSearchValue}
            filterValue={boardFilterValue}
            onFilterChange={setBoardFilterValue}
            showCreateTaskButton
            onCreateTask={() => setOpen(true)}
          />

          <div className="w-full max-w-[1080px]">
            <BacklogBoard
              title="Board"
              droppableId="backlog-board"
              items={filteredBoardItems}
              statusCounts={buildStatusCounts(filteredBoardItems)}
              onToggleCheckbox={toggleCheckbox}
              onToggleAllCheckboxes={(checked) =>
                void toggleSectionCheckboxes(filteredBoardItems, checked)
              }
              onUpdateStatus={updateItemStatus}
              onUpdateAssignee={updateItemAssignee}
              onOpenItem={(item) => setSelectedTaskDetailsId(item.id)}
              onEditItem={handleOpenEdit}
              onDeleteItem={handleDeleteItem}
              canMoveItems={canCreateSprint}
            />
          </div>

          <BacklogToolbar
            title="Sprint"
            searchPlaceholder="Search sprint..."
            searchValue={sprintSearchValue}
            onSearchChange={setSprintSearchValue}
            filterValue={sprintFilterValue}
            onFilterChange={setSprintFilterValue}
            showCreateSprintButton
            canCreateSprint={canCreateSprint}
            sprints={sprints}
            onCreateSprint={() => {
              if (!canCreateSprint) {
                return
              }

              setCreateSprintOpen(true)
            }}
            onSprintSelect={setSelectedSprintId}
          />

          <div className="w-full max-w-[1080px]">
            <BacklogBoard
              title={selectedSprint ? `Sprint - ${selectedSprint.name}` : "Sprint"}
              droppableId="backlog-sprint"
              items={filteredSprintItems}
              statusCounts={buildStatusCounts(filteredSprintItems)}
              onToggleCheckbox={toggleCheckbox}
              onToggleAllCheckboxes={(checked) =>
                void toggleSectionCheckboxes(filteredSprintItems, checked)
              }
              onUpdateStatus={updateItemStatus}
              onUpdateAssignee={updateItemAssignee}
              onOpenItem={(item) => setSelectedTaskDetailsId(item.id)}
              onEditItem={handleOpenEdit}
              onDeleteItem={handleDeleteItem}
              canMoveItems={canCreateSprint}
            />
          </div>
        </div>
        </DragDropContext>
        )}
      </div>

      <DashboardBoard
        todos={detailTodos}
        openTodoId={selectedTaskDetailsId}
        onTaskDialogClose={() => setSelectedTaskDetailsId(null)}
        renderColumns={false}
        currentUserId={currentUser?.id ?? null}
        canMoveToSprint={canCreateSprint}
        sprints={sprints}
        onStatusChange={(todoId, nextStatus) => updateItemStatus(todoId, nextStatus)}
        onMoveTodo={async (todoId, _targetTodoId, nextStatus) => {
          await updateItemStatus(todoId, nextStatus)
        }}
        onAssigneeChange={updateItemAssignee}
        onAddToSprint={moveItemToSprint}
        onMoveToBoard={moveItemToBoard}
        onTodoUpdate={handleTaskDetailsUpdate}
        onCreateSubtask={handleCreateSubtask}
        isCreatingSubtask={isCreatingSubtask}
        createSubtaskError={createSubtaskError}
        onCreateSubtaskInputChange={() => setCreateSubtaskError(null)}
        onUpdateSubtask={handleUpdateSubtask}
        onDeleteSubtask={async (_parentTodoId, subtaskId) => {
          await handleDeleteItem(subtaskId)
        }}
        onDeleteTodo={async (todo) => {
          await handleDeleteItem(todo.id)
        }}
        onArchiveTodo={handleArchiveDetailsTodo}
      />

      <CreateWorkItemDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        titleError={createTaskError}
        startDate={startDate}
        dueDate={dueDate}
        description={description}
        onTitleChange={(value) => {
          setCreateTaskError(null)
          setTitle(value)
        }}
        onStartDateChange={setStartDate}
        onDueDateChange={setDueDate}
        onDescriptionChange={setDescription}
        isSubmitting={isCreatingTask}
        onAddItem={handleAddItem}
      />

      <EditWorkItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={editTitle}
        description={editDescription}
        startDate={editStartDate}
        dueDate={editDueDate}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onStartDateChange={setEditStartDate}
        onDueDateChange={setEditDueDate}
        onSave={handleSaveEdit}
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
