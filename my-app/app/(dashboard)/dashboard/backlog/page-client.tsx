"use client"
import { hasCompletedTaskParent, isTaskCompletionLocked } from "@/lib/task-completion"

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
import { CreateWorkItemDialog } from "./components/create-work-item-dialog"
import { EditWorkItemDialog } from "./components/edit-work-item-dialog"
import {
  createAssigneeOptionsFromProject,
  setAssigneeOptions,
  statusOptions,
  type WorkItem,
} from "./types"
import {
  buildSubtaskDisplayId,
  buildTaskDisplayId,
  compareTasksByPriority,
  normalizeTaskDescription,
} from "../utils"
import {
  cacheDashboardProjects,
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  type DashboardProject,
} from "@/lib/projects"
import {
  markDashboardProjectPageSeenInSession,
} from "@/lib/dashboard-first-open"
import {
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { readClientAuthSession, subscribeToAuthChange, type AuthenticatedUser } from "@/lib/auth-client"
import { getLocalDateString } from "@/lib/trusted-time"
import { useTaskReadOnly } from "@/lib/role-context"

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
      createdByUserId: item.createdByUserId ?? null,
      createdByName: item.createdByName ?? null,
      title: item.title,
      description: normalizeTaskDescription(item.description),
      startDate: item.startDate ? new Date(item.startDate) : undefined,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      status: item.status,
      checked: item.checked,
      assigneeId: item.assigneeId ?? null,
      priority: item.priority ?? "Medium",
    }
  })
}

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

type BacklogPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}

export function BacklogPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
}: BacklogPageClientProps) {
  const router = useRouter()
  const taskReadOnly = useTaskReadOnly()
  const initialProject = React.useMemo(
    () =>
      initialProjects.find((project) => project.id === initialSelectedProjectId) ?? null,
    [initialProjects, initialSelectedProjectId]
  )
  const initialProjectCode = React.useMemo(
    () => getDashboardProjectCode(initialProject),
    [initialProject]
  )
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [createTaskError, setCreateTaskError] = React.useState<string | null>(null)
  const [startDate, setStartDate] = React.useState<Date | undefined>()
  const [dueDate, setDueDate] = React.useState<Date | undefined>()
  const [description, setDescription] = React.useState("")
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null)
  const [priority, setPriority] =
    React.useState<"Low" | "Medium" | "High">("Medium")
  const [chapterNumber, setChapterNumber] = React.useState<number | null>(null)
  const [isCreatingTask, setIsCreatingTask] = React.useState(false)
  const [boardSearchValue, setBoardSearchValue] = React.useState("")
  const [boardFilterValue, setBoardFilterValue] =
    React.useState<BacklogSectionFilter>("none")
  const [selectedTaskDetailsId, setSelectedTaskDetailsId] = React.useState<string | null>(null)
  const [isCreatingSubtask, setIsCreatingSubtask] = React.useState(false)
  const [createSubtaskError, setCreateSubtaskError] = React.useState<string | null>(null)
  const isMovingRootItemRef = React.useRef(false)

  const [items, setItems] = React.useState<WorkItem[]>(() =>
    initialSelectedProjectId ? mapApiItems(initialItems, initialProjectCode) : []
  )
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const canChangeTaskState = Boolean(currentUser) && !taskReadOnly
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(
    initialSelectedProjectId
  )
  const [isDragDropReady, setIsDragDropReady] = React.useState(false)

  const activeProject = React.useMemo(
    () =>
      initialProjects.find((project) => project.id === activeProjectId) ??
      findDashboardProject(activeProjectId) ??
      null,
    [activeProjectId, initialProjects]
  )
  const canEditTaskFields = React.useMemo(() => {
    if (taskReadOnly || currentUser?.role !== "faculty" || !activeProject) {
      return false
    }

    const currentUserName = normalizePersonName(currentUser.name)

    return (
      currentUserName.length > 0 &&
      activeProject.advisers.some(
        (adviserName) => normalizePersonName(adviserName) === currentUserName
      )
    )
  }, [activeProject, currentUser, taskReadOnly])

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
    setActiveProjectId(initialSelectedProjectId)
  }, [initialSelectedProjectId])

  React.useEffect(() => {
    if (initialSelectedProjectId) {
      markDashboardProjectPageSeenInSession("backlog", initialSelectedProjectId)
    }
  }, [initialSelectedProjectId])

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
    setAssigneeOptions(createAssigneeOptionsFromProject(selectedProject, currentUser))
    setItems(mapApiItems(initialItems, projectCode))
  }, [currentUser, initialItems, initialProjects, initialSelectedProjectId])

  const orderedItems = React.useMemo(() => {
    const deadlineTime = (item: WorkItem) => {
      const timestamp = item.dueDate?.getTime()
      return timestamp !== undefined && Number.isFinite(timestamp)
        ? timestamp
        : Number.POSITIVE_INFINITY
    }
    const priorityRank = { High: 0, Medium: 1, Low: 2 }
    const sortedItems = [...items].sort((left, right) => {
      const priorityDifference = priorityRank[left.priority ?? "Medium"] - priorityRank[right.priority ?? "Medium"]
      if (priorityDifference) return priorityDifference
      const leftDeadline = deadlineTime(left)
      const rightDeadline = deadlineTime(right)
      if (leftDeadline !== rightDeadline) {
        return leftDeadline < rightDeadline ? -1 : 1
      }
      return compareTasksByPriority(left, right)
    })
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
      setActiveProjectId(selectedProjectId)
      setEditOpen(false)
      setEditingItemId(null)

      if (!selectedProjectId || !selectedProject) {
        router.replace("/dashboard")
        return
      }

      setAssigneeOptions(createAssigneeOptionsFromProject(selectedProject, currentUser))

      if (selectedProjectId === initialSelectedProjectId) {
        return
      }

      try {
        const itemsResponse = await fetch(`/api/backlog-items?projectId=${selectedProjectId}&limit=500`, {
          cache: "no-store",
        })

        if (!itemsResponse.ok) {
          throw new Error("Failed to load backlog items")
        }

        const data = (await itemsResponse.json()) as { items: BacklogApiItem[] }
        const projectCode = getDashboardProjectCode(selectedProject)

        if (!cancelled) {
          setItems(mapApiItems(data.items, projectCode))
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
  }, [currentUser, initialSelectedProjectId, router])

  const resetForm = () => {
    setTitle("")
    setCreateTaskError(null)
    setStartDate(undefined)
    setDueDate(undefined)
    setDescription("")
    setAssigneeId(null)
    setPriority("Medium")
    setChapterNumber(null)
  }

  const handleAddItem = async () => {
    if (!canChangeTaskState || isCreatingTask) return

    if (!title.trim() || !startDate || !dueDate || !chapterNumber) {
      setCreateTaskError("Title, chapter, start date, and due date are required")
      return
    }

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
          startDate: startDate ? getLocalDateString(startDate) : null,
          dueDate: dueDate ? getLocalDateString(dueDate) : null,
          assigneeId,
          priority,
          chapterNumber,
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
    if (!canChangeTaskState) return
    const currentItem = items.find((item) => item.id === id)
    if (!currentItem || hasCompletedTaskParent(currentItem, items) ||
      (currentItem.status === "completed" && (!canEditTaskFields || nextStatus !== "revision"))) return

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus, checked: nextStatus === "completed" } : item))
    )

    try {
      const response = await fetch(`/api/backlog-items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus, checked: nextStatus === "completed" }),
      })

      if (!response.ok) {
        throw new Error("Failed to update backlog item status")
      }
    } catch (error) {
      console.error(error)
      setItems((prev) => prev.map((item) => item.id === id ? currentItem : item))
    }
  }

  const toggleCheckbox = async (id: string, checked: boolean) => {
    if (!canChangeTaskState) return
    const item = items.find((candidate) => candidate.id === id)
    if (!item || isTaskCompletionLocked(item, items)) return

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
    if (!canEditTaskFields) {
      return
    }

    const currentItem = items.find((item) => item.id === id)

    if (!currentItem || isTaskCompletionLocked(currentItem, items)) {
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
    if (!canEditTaskFields) return

    setEditingItemId(item.id)
    setEditTitle(item.title)
    setEditDescription(item.description)
    setEditStartDate(item.startDate)
    setEditDueDate(item.dueDate)
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!canEditTaskFields || !editingItemId || !editTitle.trim()) return

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
          startDate: editStartDate ? getLocalDateString(editStartDate) : null,
          dueDate: editDueDate ? getLocalDateString(editDueDate) : null,
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

  const handleArchiveDetailsTodo = React.useCallback(
    async (todo: TodoItem) => {
      if (!canChangeTaskState) return

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
    [canChangeTaskState, items]
  )

  const canManageProjectResources =
    !taskReadOnly && (currentUser?.role === "faculty" || currentUser?.role === "admin")

  const formatTaskDate = React.useCallback((date?: Date) => {
    return date ? getLocalDateString(date) : ""
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
        createdByUserId: item.createdByUserId ?? null,
        createdByName: item.createdByName ?? null,
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
        priority: item.priority ?? "Medium",
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
      if (!canChangeTaskState) return

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
    [canChangeTaskState]
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
      if (!canChangeTaskState || isCreatingSubtask) {
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
            createdByUserId: data.item.createdByUserId ?? currentUser?.id ?? null,
            createdByName: data.item.createdByName ?? currentUser?.name ?? null,
            title: data.item.title,
            description: data.item.description,
            startDate: data.item.startDate ? new Date(data.item.startDate) : undefined,
            dueDate: data.item.dueDate ? new Date(data.item.dueDate) : undefined,
            status: data.item.status,
            checked: data.item.checked,
            assigneeId: data.item.assigneeId ?? null,
            priority: data.item.priority ?? "Medium",
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
    [canChangeTaskState, currentUser, isCreatingSubtask, items, router]
  )

  const handleUpdateSubtask = React.useCallback(
    async (
      subtaskId: string,
      updates: Pick<TodoItem, "title" | "description" | "startDate" | "deadline">
    ) => {
      if (!canChangeTaskState) return

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
    [canChangeTaskState]
  )

  const filteredBoardItems = React.useMemo(
    () => filterSectionItems(
      orderedItems.filter((item) => item.status !== "completed"),
      boardSearchValue,
      boardFilterValue
    ),
    [boardFilterValue, boardSearchValue, filterSectionItems, orderedItems]
  )

  const buildSectionTree = React.useCallback((sourceItems: WorkItem[], predicate: (item: WorkItem) => boolean) => {
    const childItemsByParentId = new Map<string, WorkItem[]>()

    for (const item of sourceItems) {
      if (!item.parentId) {
        continue
      }

      const currentChildren = childItemsByParentId.get(item.parentId) ?? []
      currentChildren.push(item)
      childItemsByParentId.set(item.parentId, currentChildren)
    }

    const scopedItems: WorkItem[] = []
    const appendTree = (item: WorkItem) => {
      scopedItems.push(item)

      const childItems = childItemsByParentId.get(item.id) ?? []

      for (const childItem of childItems) {
        appendTree(childItem)
      }
    }

    for (const item of sourceItems) {
      if (item.parentId || !predicate(item)) {
        continue
      }

      appendTree(item)
    }

    return scopedItems
  }, [])

  const boardItems = React.useMemo(
    () =>
      buildSectionTree(
        filteredBoardItems,
        () => true
      ),
    [buildSectionTree, filteredBoardItems]
  )

  const visibleRootItems = React.useMemo(
    () => boardItems.filter((item) => !item.parentId),
    [boardItems]
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

      return statusOptions.filter((status) => status.value !== "completed").map((status) => ({
        ...status,
        count: countsByStatus[status.value] ?? 0,
      }))
    },
    []
  )

  const moveRootItem = React.useCallback(
    async (result: DropResult) => {
      if (!canChangeTaskState) return

      const { source, destination, draggableId } = result
      const itemId = draggableId.startsWith(`${source.droppableId}:`)
        ? draggableId.slice(source.droppableId.length + 1)
        : draggableId

      if (
        !destination ||
        isMovingRootItemRef.current ||
        source.droppableId !== "backlog-board" ||
        destination.droppableId !== "backlog-board"
      ) {
        return
      }

      const movedItem = visibleRootItems.find((item) => item.id === itemId)

      if (!movedItem || isTaskCompletionLocked(movedItem, items)) {
        return
      }

      isMovingRootItemRef.current = true

      const nextRootItems = visibleRootItems.filter((item) => item.id !== itemId)
      nextRootItems.splice(destination.index, 0, movedItem)

      const nextRootOrderIndexById = new Map<string, number>()

      nextRootItems.forEach((item, index) => {
        nextRootOrderIndexById.set(item.id, index + 1)
      })

      const previousItems = items
      const nextItems = items.map((item) => {
        if (item.parentId || item.status === "completed") {
          return item
        }

        return {
          ...item,
          orderIndex: nextRootOrderIndexById.get(item.id) ?? item.orderIndex,
        }
      })
      const previousRootItemById = new Map(
        previousItems
          .filter((item) => !item.parentId)
          .map((item) => [item.id, item])
      )
      const rootItemsToPersist = nextItems.filter((item) => {
        if (item.parentId || item.status === "completed") {
          return false
        }

        const previousItem = previousRootItemById.get(item.id)

        return (
          !previousItem ||
          previousItem.orderIndex !== item.orderIndex
        )
      })

      setItems(nextItems)

      try {
        await Promise.all(
          rootItemsToPersist
            .map((item) =>
              fetch(`/api/backlog-items/${item.id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  orderIndex: item.orderIndex,
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
        setItems(previousItems)
      } finally {
        isMovingRootItemRef.current = false
      }
    },
    [canChangeTaskState, items, visibleRootItems]
  )

  const handleBacklogDragEnd = React.useCallback(
    (result: DropResult) => {
      if (!canChangeTaskState) return

      const { source, destination } = result

      if (!destination) {
        return
      }

      const samePosition =
        source.droppableId === destination.droppableId &&
        source.index === destination.index

      if (samePosition) {
        return
      }

      void moveRootItem(result)
    },
    [canChangeTaskState, moveRootItem]
  )

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
            showCreateTaskButton={canChangeTaskState && currentUser?.role !== "admin"}
            onCreateTask={() => setOpen(true)}
          />

          <div className="w-full">
            <BacklogBoard
              title="Backlog"
              droppableId="backlog-board"
              items={boardItems}
              statusCounts={buildStatusCounts(boardItems)}
              onToggleCheckbox={toggleCheckbox}
              onUpdateStatus={updateItemStatus}
              onUpdateAssignee={updateItemAssignee}
              onOpenItem={(item) => setSelectedTaskDetailsId(item.id)}
              onEditItem={handleOpenEdit}
              canEditItems={canEditTaskFields}
              canEditAssignee={canEditTaskFields}
              canMoveItems={canChangeTaskState}
              canChangeTaskState={canChangeTaskState}
              emptyLabel="There's nothing in this backlog"
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
        canChangeTaskState={canChangeTaskState}
        canEditAssignee={canEditTaskFields}
        canManageOtherProjectResources={canManageProjectResources}
        onStatusChange={(todoId, nextStatus) => updateItemStatus(todoId, nextStatus)}
        onMoveTodo={async (todoId, _targetTodoId, nextStatus) => {
          await updateItemStatus(todoId, nextStatus)
        }}
        onAssigneeChange={updateItemAssignee}
        onTodoUpdate={handleTaskDetailsUpdate}
        onCreateSubtask={handleCreateSubtask}
        isCreatingSubtask={isCreatingSubtask}
        createSubtaskError={createSubtaskError}
        onCreateSubtaskInputChange={() => setCreateSubtaskError(null)}
        onUpdateSubtask={handleUpdateSubtask}
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
        assigneeId={assigneeId}
        priority={priority}
        chapterNumber={chapterNumber}
        onTitleChange={(value) => {
          setCreateTaskError(null)
          setTitle(value)
        }}
        onStartDateChange={setStartDate}
        onDueDateChange={setDueDate}
        onDescriptionChange={setDescription}
        onAssigneeChange={setAssigneeId}
        onPriorityChange={setPriority}
        onChapterChange={setChapterNumber}
        isSubmitting={isCreatingTask}
        onAddItem={handleAddItem}
      />

      {canEditTaskFields ? (
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
      ) : null}

    </div>
  )
}
