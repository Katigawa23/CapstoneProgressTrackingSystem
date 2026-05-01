"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Ellipsis } from "lucide-react"

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
import { DashboardHeader, type DashboardBoardFilter } from "../components/dashboard-header"
import { CreateSprintDialog } from "../components/create-sprint-dialog"
import type { BacklogApiItem, TodoItem } from "../types"
import { mapBacklogItemsToTodos } from "../utils"

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
  createdByUserId: string
  startDate: string
  endDate: string
  backlogItemIds: string[]
}

function formatSprintKey(sequenceNumber: number) {
  return `SP-${sequenceNumber}`
}

function formatSprintDue(startDate: string, endDate: string) {
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

function formatCreatedBy(createdByUserId: string, currentUser: AuthenticatedUser | null) {
  if (currentUser?.id && createdByUserId === currentUser.id) {
    return currentUser.name?.trim() || "You"
  }

  return createdByUserId
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
  const [sprintDuration, setSprintDuration] = React.useState("2-weeks")
  const [sprintStartDate, setSprintStartDate] = React.useState<Date | undefined>()
  const [sprintEndDate, setSprintEndDate] = React.useState<Date | undefined>()
  const [sprintScopeItemId, setSprintScopeItemId] = React.useState("")
  const [sprintDescription, setSprintDescription] = React.useState("")
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
  const selectedSprint = React.useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  )
  const canCreateSprint = React.useMemo(
    () => canCreateSprintForProject(selectedProject, currentUser),
    [currentUser, selectedProject]
  )

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
    setSprintDuration("2-weeks")
    setSprintStartDate(undefined)
    setSprintEndDate(undefined)
    setSprintScopeItemId("")
    setSprintDescription("")
  }, [])

  const handleCreateSprint = React.useCallback(async () => {
    if (!sprintName.trim() || !sprintStartDate || !sprintEndDate) {
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
        throw new Error("Failed to create sprint")
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
      console.error(error)
    }
  }, [
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <DashboardHeader
        people={projectPeople}
        breadcrumbSectionLabel="Active Sprint"
        activeSprintName={null}
        sprintDescription={selectedSprint?.description ?? null}
        sprintCountdownLabel={null}
        boardTitle="Active Sprint"
        showCreateButton={false}
        canCreateSprint={canCreateSprint}
        sprints={sprints}
        onProjectBoardSelect={() => {
          router.push("/dashboard/board")
        }}
        onSprintSelect={(sprintId) => {
          router.push(`/dashboard/active-sprint/${sprintId}`)
        }}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        onCreateSprint={() => {
          if (!canCreateSprint) {
            return
          }

          setCreateSprintOpen(true)
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
                    <span className="truncate whitespace-nowrap">
                      {formatCreatedBy(sprint.createdByUserId, currentUser)}
                    </span>
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
                    <button
                      type="button"
                      aria-label={`Sprint actions for ${sprint.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
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
        duration={sprintDuration}
        startDate={sprintStartDate}
        endDate={sprintEndDate}
        scopeItemId={sprintScopeItemId}
        description={sprintDescription}
        scopeOptions={sprintScopeOptions}
        onSprintNameChange={setSprintName}
        onDurationChange={setSprintDuration}
        onStartDateChange={setSprintStartDate}
        onEndDateChange={setSprintEndDate}
        onScopeItemChange={setSprintScopeItemId}
        onDescriptionChange={setSprintDescription}
        onCreateSprint={handleCreateSprint}
      />
    </div>
  )
}
