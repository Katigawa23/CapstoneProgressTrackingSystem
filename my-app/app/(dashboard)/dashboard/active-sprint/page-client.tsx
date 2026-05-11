"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Archive, Ellipsis, Pencil, Trash2 } from "lucide-react"

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
import { getTrustedTodayDayNumber, parseDateStringToDayNumber } from "@/lib/trusted-time"
import {
  TASK_SPRINT_NAME_MAX_LENGTH,
  validateDisplayName,
} from "@/lib/text-validation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DashboardHeader, type DashboardBoardFilter } from "../components/dashboard-header"
import { CreateSprintDialog } from "../components/create-sprint-dialog"
import type { BacklogApiItem, TodoItem } from "../types"
import { getInitials, mapBacklogItemsToTodos } from "../utils"

type ActiveSprintPageClientProps = {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}

type SprintSummary = {
  id: string
  sequenceNumber: number
  name: string
  description: string
  duration: string
  createdByUserId: string
  startDate: string
  endDate: string
  backlogItemIds: string[]
}

function formatSprintKey(sequenceNumber: number) {
  return `SP-${sequenceNumber}`
}

function formatSprintDue(startDate: string, endDate: string) {
  const sprintStartDay = parseDateStringToDayNumber(startDate)
  const dueDay = parseDateStringToDayNumber(endDate)
  const todayDay = getTrustedTodayDayNumber()

  if (
    Number.isNaN(sprintStartDay) ||
    Number.isNaN(dueDay) ||
    Number.isNaN(todayDay)
  ) {
    return "0 days remaining"
  }

  if (todayDay > dueDay) {
    const overdueDays = todayDay - dueDay

    return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
  }

  const countdownStartDay = Math.max(todayDay, sprintStartDay)
  const differenceInDays = dueDay - countdownStartDay + 1

  if (differenceInDays === 0) {
    return "0 days remaining"
  }

  return `${differenceInDays} day${differenceInDays === 1 ? "" : "s"} remaining`
}

function formatCreatedBy(createdByUserId: string, currentUser: AuthenticatedUser | null) {
  if (currentUser?.id && createdByUserId === currentUser.id) {
    return currentUser.name?.trim() || "You"
  }

  return createdByUserId
}

function parseDateStringToDate(dateString: string) {
  if (!dateString) {
    return undefined
  }

  const parsedDate = new Date(`${dateString}T00:00:00`)
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate
}

export function ActiveSprintPageClient({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
}: ActiveSprintPageClientProps) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(
    initialSelectedProjectId
  )
  const [todos, setTodos] = React.useState<TodoItem[]>([])
  const [createSprintOpen, setCreateSprintOpen] = React.useState(false)
  const [sprintName, setSprintName] = React.useState("")
  const [createSprintError, setCreateSprintError] = React.useState<string | null>(null)
  const [sprintDuration, setSprintDuration] = React.useState("2-weeks")
  const [sprintStartDate, setSprintStartDate] = React.useState<Date | undefined>()
  const [sprintEndDate, setSprintEndDate] = React.useState<Date | undefined>()
  const [sprintScopeItemId, setSprintScopeItemId] = React.useState("")
  const [sprintDescription, setSprintDescription] = React.useState("")
  const [isCreatingSprint, setIsCreatingSprint] = React.useState(false)
  const [sprintDialogMode, setSprintDialogMode] = React.useState<"create" | "edit">("create")
  const [editingSprint, setEditingSprint] = React.useState<SprintSummary | null>(null)
  const [pendingArchiveSprint, setPendingArchiveSprint] = React.useState<SprintSummary | null>(null)
  const [pendingDeleteSprint, setPendingDeleteSprint] = React.useState<SprintSummary | null>(null)
  const [deleteSprintConfirmation, setDeleteSprintConfirmation] = React.useState("")
  const [sprints, setSprints] = React.useState<SprintSummary[]>([])
  const [selectedSprintId, setSelectedSprintId] = React.useState<string | null>(null)
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValue, setFilterValue] =
    React.useState<DashboardBoardFilter>("none")
  const selectedProject = React.useMemo(
    () =>
      initialProjects.find((project) => project.id === selectedProjectId) ??
      findDashboardProject(selectedProjectId) ??
      null,
    [initialProjects, selectedProjectId]
  )
  const canCreateSprint = React.useMemo(
    () => canCreateSprintForProject(selectedProject, currentUser),
    [currentUser, selectedProject]
  )
  const expectedDeleteSprintConfirmation = pendingDeleteSprint
    ? `Delete/${pendingDeleteSprint.name}`
    : ""

  React.useEffect(() => {
    if (selectedSprintId || sprints.length === 0) {
      return
    }

    setSelectedSprintId(sprints[0]?.id ?? null)
  }, [selectedSprintId, sprints])
  const visibleSprints = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return sprints
    }

    return sprints.filter((sprint) => {
      const sprintKey = formatSprintKey(sprint.sequenceNumber).toLowerCase()

      return (
        sprint.name.toLowerCase().includes(normalizedSearch) ||
        sprintKey.includes(normalizedSearch)
      )
    })
  }, [searchValue, sprints])
  const getCurrentProjectCode = React.useCallback((projectId?: string | null) => {
    const activeProjectId = projectId ?? getSelectedDashboardProjectId()
    return getDashboardProjectCode(findDashboardProject(activeProjectId))
  }, [])
  const projectPeople = React.useMemo(
    () => {
      const memberNames = new Set(
        (selectedProject?.members ?? [])
          .map((member) => member.trim())
          .filter(Boolean)
      )

      if (currentUser?.name?.trim()) {
        memberNames.add(currentUser.name.trim())
      }

      return Array.from(memberNames).map((member) => ({ name: member, src: "" }))
    },
    [currentUser, selectedProject]
  )

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

  const fetchTodosForProject = React.useCallback(
    async (projectId: string) => {
      const response = await fetch(`/api/backlog-items?projectId=${projectId}&limit=500`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load backlog items")
      }

      const data = (await response.json()) as { items: BacklogApiItem[] }

      return mapBacklogItemsToTodos(data.items, getCurrentProjectCode(projectId))
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

    if (initialSelectedProjectId) {
      setTodos(mapBacklogItemsToTodos(initialItems, getCurrentProjectCode(initialSelectedProjectId)))
    }
  }, [getCurrentProjectCode, initialItems, initialProjects, initialSelectedProjectId])

  React.useEffect(() => {
    let cancelled = false

    async function loadSprintsForSelectedProject() {
      const savedProjectId = getSelectedDashboardProjectId()

      if (!savedProjectId || !findDashboardProject(savedProjectId)) {
        router.replace("/dashboard")
        return
      }

      setSelectedProjectId(savedProjectId)

      try {
        const [nextTodos, nextSprints] = await Promise.all([
          fetchTodosForProject(savedProjectId),
          fetchSprintsForProject(savedProjectId),
        ])

        if (!cancelled) {
          setTodos(nextTodos)
          setSprints(nextSprints)
          setSelectedSprintId((currentSelectedSprintId) =>
            nextSprints.some((sprint) => sprint.id === currentSelectedSprintId)
              ? currentSelectedSprintId
              : null
          )
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
        }
      }
    }

    void loadSprintsForSelectedProject()
    window.addEventListener(PROJECT_CHANGE_EVENT, loadSprintsForSelectedProject)

    return () => {
      cancelled = true
      window.removeEventListener(PROJECT_CHANGE_EVENT, loadSprintsForSelectedProject)
    }
  }, [fetchSprintsForProject, fetchTodosForProject, initialProjects, router])

  const resetCreateSprintForm = React.useCallback(() => {
    setSprintName("")
    setCreateSprintError(null)
    setSprintDuration("2-weeks")
    setSprintStartDate(undefined)
    setSprintEndDate(undefined)
    setSprintScopeItemId("")
    setSprintDescription("")
    setEditingSprint(null)
    setSprintDialogMode("create")
  }, [])

  const openCreateSprintDialog = React.useCallback(() => {
    if (!canCreateSprint) {
      return
    }

    resetCreateSprintForm()
    setSprintDialogMode("create")
    setCreateSprintOpen(true)
  }, [canCreateSprint, resetCreateSprintForm])

  const openEditSprintDialog = React.useCallback(
    (sprint: SprintSummary) => {
      if (!canCreateSprint) {
        return
      }

      setEditingSprint(sprint)
      setSprintDialogMode("edit")
      setSprintName(sprint.name)
      setSprintDuration(sprint.duration || "custom")
      setSprintStartDate(parseDateStringToDate(sprint.startDate))
      setSprintEndDate(parseDateStringToDate(sprint.endDate))
      setSprintScopeItemId("")
      setSprintDescription(sprint.description)
      setCreateSprintError(null)
      setCreateSprintOpen(true)
    },
    [canCreateSprint]
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
      setSelectedSprintId(data.sprint.id)
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

  const handleUpdateSprint = React.useCallback(async () => {
    if (
      isCreatingSprint ||
      !editingSprint ||
      !selectedProjectId ||
      !sprintName.trim() ||
      !sprintStartDate ||
      !sprintEndDate ||
      !canCreateSprint
    ) {
      return
    }

    const nameValidationError = validateDisplayName(sprintName, "Sprint name", {
      maxLength: TASK_SPRINT_NAME_MAX_LENGTH,
    })

    if (nameValidationError) {
      setCreateSprintError(nameValidationError)
      return
    }

    try {
      setIsCreatingSprint(true)
      const response = await fetch(`/api/sprints/${editingSprint.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: sprintName.trim(),
          duration: sprintDuration,
          startDate: sprintStartDate.toISOString().slice(0, 10),
          endDate: sprintEndDate.toISOString().slice(0, 10),
          description: sprintDescription.trim(),
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to update sprint")
      }

      const data = (await response.json()) as {
        sprint: SprintSummary
      }

      setSprints((currentSprints) =>
        currentSprints.map((sprint) =>
          sprint.id === data.sprint.id ? data.sprint : sprint
        )
      )
      setCreateSprintOpen(false)
      resetCreateSprintForm()
    } catch (error) {
      setCreateSprintError(
        error instanceof Error ? error.message : "Failed to update sprint"
      )
    } finally {
      setIsCreatingSprint(false)
    }
  }, [
    canCreateSprint,
    editingSprint,
    isCreatingSprint,
    resetCreateSprintForm,
    selectedProjectId,
    sprintDescription,
    sprintDuration,
    sprintEndDate,
    sprintName,
    sprintStartDate,
  ])

  const handleArchiveSprint = React.useCallback(async () => {
    if (!pendingArchiveSprint || !selectedProjectId || !canCreateSprint) {
      return
    }

    const sprintId = pendingArchiveSprint.id
    const response = await fetch(
      `/api/sprints/${sprintId}?projectId=${encodeURIComponent(selectedProjectId)}&action=archive`,
      { method: "DELETE" }
    )

    if (!response.ok) {
      return
    }

    setSprints((currentSprints) =>
      currentSprints.filter((sprint) => sprint.id !== sprintId)
    )
    if (selectedSprintId === sprintId) {
      setSelectedSprintId(null)
    }
    setPendingArchiveSprint(null)
  }, [canCreateSprint, pendingArchiveSprint, selectedProjectId, selectedSprintId])

  const handleDeleteSprint = React.useCallback(async () => {
    if (
      !pendingDeleteSprint ||
      !selectedProjectId ||
      !canCreateSprint ||
      deleteSprintConfirmation.trim() !== expectedDeleteSprintConfirmation
    ) {
      return
    }

    const sprintId = pendingDeleteSprint.id
    const response = await fetch(
      `/api/sprints/${sprintId}?projectId=${encodeURIComponent(selectedProjectId)}&action=delete`,
      { method: "DELETE" }
    )

    if (!response.ok) {
      return
    }

    setSprints((currentSprints) =>
      currentSprints.filter((sprint) => sprint.id !== sprintId)
    )
    if (selectedSprintId === sprintId) {
      setSelectedSprintId(null)
    }
    setPendingDeleteSprint(null)
    setDeleteSprintConfirmation("")
  }, [
    canCreateSprint,
    deleteSprintConfirmation,
    expectedDeleteSprintConfirmation,
    pendingDeleteSprint,
    selectedProjectId,
    selectedSprintId,
  ])

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader
        people={projectPeople}
        breadcrumbSectionLabel="Active Sprint"
        activeSprintName={null}
        showFilter={false}
        sprintCountdownLabel={null}
        boardTitle="Active Sprint"
        showCreateButton={false}
        canCreateSprint={canCreateSprint}
        sprints={sprints}
        onProjectSelect={() => {
          router.push("/dashboard/board")
        }}
        onBreadcrumbSectionSelect={() => {
          router.push("/dashboard/active-sprint")
        }}
        onSprintSelect={(sprintId) => {
          router.push(`/dashboard/active-sprint/${sprintId}`)
        }}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        onCreateSprint={() => {
          openCreateSprintDialog()
        }}
        onManageSprints={() => {}}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-8">
        <div className="max-w-[760px] overflow-hidden border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#171717]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_144px_48px] gap-1.5 border-b border-slate-200/80 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Sprint Name</span>
            <span>Created By</span>
            <span>ID</span>
            <span>Due</span>
            <span className="text-center">Action</span>
          </div>

          {visibleSprints.length > 0 ? (
            visibleSprints.map((sprint) => {
              const createdByName = formatCreatedBy(sprint.createdByUserId, currentUser)

              return (
                <div
                  key={sprint.id}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_76px_144px_48px] items-center gap-1.5 border-b border-slate-200/70 px-3 py-2 transition last:border-b-0 dark:border-slate-800/90 ${
                    "bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#171717] dark:text-slate-200 dark:hover:bg-[#1d1d1d]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/active-sprint/${sprint.id}`)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate whitespace-nowrap text-[13px] font-medium">{sprint.name}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/active-sprint/${sprint.id}`)}
                    className="flex min-w-0 items-center text-left text-[13px] text-slate-600 dark:text-slate-300"
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar size="sm" className="h-6 w-6">
                              <AvatarFallback className="text-[9px]">
                                {getInitials(createdByName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate whitespace-nowrap" title={createdByName}>
                              {createdByName}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>
                          {createdByName}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/active-sprint/${sprint.id}`)}
                    className="flex items-center whitespace-nowrap text-left text-[13px] font-medium text-slate-600 dark:text-slate-300"
                  >
                    {formatSprintKey(sprint.sequenceNumber)}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/active-sprint/${sprint.id}`)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate whitespace-nowrap text-[13px] text-slate-600 dark:text-slate-300">
                      {formatSprintDue(sprint.startDate, sprint.endDate)}
                    </p>
                  </button>
                  <div className="flex justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Sprint actions for ${sprint.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 border-slate-200 bg-white text-slate-700 shadow-lg dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                      >
                        <DropdownMenuItem
                          disabled={!canCreateSprint}
                          onSelect={() => openEditSprintDialog(sprint)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canCreateSprint}
                          onSelect={() => setPendingArchiveSprint(sprint)}
                          className="gap-2"
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canCreateSprint}
                          onSelect={() => setPendingDeleteSprint(sprint)}
                          className="gap-2 text-red-600 focus:text-red-600 disabled:text-slate-400 dark:text-red-300 dark:focus:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No sprints found.
            </div>
          )}
        </div>
      </div>

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
        mode={sprintDialogMode}
        onCreateSprint={sprintDialogMode === "edit" ? handleUpdateSprint : handleCreateSprint}
      />

      <AlertDialog
        open={pendingArchiveSprint !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingArchiveSprint(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-100">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <AlertDialogTitle>Archive Sprint</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span className="block">
                This sprint will be hidden from Active Sprint.
              </span>
              <span className="block">
                Work items already in the sprint will stay in their current board status.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px]"
              onClick={() => void handleArchiveSprint()}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteSprint !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingDeleteSprint(null)
            setDeleteSprintConfirmation("")
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-100">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                <Trash2 className="h-4 w-4" />
              </div>
              <AlertDialogTitle>Delete Sprint</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span className="block">
                This sprint will be removed from Active Sprint.
              </span>
              <span className="block">
                Work items already in the sprint will stay in their current board status.
              </span>
              <span className="block">
                Type <span className="font-semibold text-slate-900 dark:text-slate-100">{expectedDeleteSprintConfirmation}</span> to confirm.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteSprintConfirmation}
            onChange={(event) => setDeleteSprintConfirmation(event.target.value)}
            placeholder={expectedDeleteSprintConfirmation}
            className="h-9 rounded-[2px] border-slate-200 bg-white text-sm dark:border-[#454545] dark:bg-[#1f1f1f]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              disabled={deleteSprintConfirmation.trim() !== expectedDeleteSprintConfirmation}
              className="rounded-[2px] bg-red-600 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                if (deleteSprintConfirmation.trim() !== expectedDeleteSprintConfirmation) {
                  event.preventDefault()
                  return
                }

                void handleDeleteSprint()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
