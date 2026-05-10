"use client"

import * as React from "react"
import Link from "next/link"
import {
  Archive,
  CheckSquare2,
  GitFork,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import {
  type DashboardProject,
  PROJECTS_CHANGE_EVENT,
  cacheDashboardProjects,
  getDashboardProjects,
  setDashboardProject,
  setDashboardProjectStarred,
} from "@/lib/projects"
import {
  readClientAuthSession,
  subscribeToAuthChange,
  type AuthenticatedUser,
} from "@/lib/auth-client"
import {
  formatTrustedDate,
  getTrustedCurrentYear,
  getTrustedNowDate,
} from "@/lib/trusted-time"
import { canCreateProject as canCreateProjectForRole, isUserRole } from "@/lib/rbac"
import {
  subscribeToDashboardActivitySync,
} from "@/lib/dashboard-activity-sync"
import { writeDashboardHomeState } from "@/lib/dashboard-home-state"
import { buildAssigneeOptionId } from "./backlog/types"
import type { BacklogApiItem } from "./types"

type DashboardActivity = {
  id: string
  title: string
  action: "Created" | "Assigned" | "Viewed" | "Starred"
  createdAt: string
  itemKey: string
  isSubtask: boolean
  projectId: string
  projectName: string
  projectMember: string
}

type DashboardPageClientProps = {
  initialProjects: DashboardProject[]
  initialActivities: Array<
    BacklogApiItem & {
      projectName: string
      projectType: string
      projectMembers: string[]
    }
  >
}

export function DashboardPageClient({
  initialProjects,
  initialActivities,
}: DashboardPageClientProps) {
  const router = useRouter()
  const [hasHydrated, setHasHydrated] = React.useState(false)
  const recentProjectsScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [projects, setProjects] = React.useState<DashboardProject[]>(initialProjects)
  const [activityItems, setActivityItems] = React.useState(initialActivities)
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const canCreateProject =
    currentUser?.role && isUserRole(currentUser.role)
      ? canCreateProjectForRole(currentUser.role)
      : false
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

  const getMemberInitials = React.useCallback((name: string) => {
    return name
      .split(" ")
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }, [])

  const getProjectTypeCode = React.useCallback((projectType: string) => {
    const words = projectType
      .trim()
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean)

    if (words.length >= 2) {
      return `${words[0][0] ?? "P"}${words[1][0] ?? "J"}`
    }

    const normalized = words[0] ?? ""

    if (!normalized) {
      return "PJ"
    }

    const consonant = normalized
      .slice(1)
      .split("")
      .find((character) => !"AEIOU".includes(character))

    const fallback = normalized[1] ?? "X"

    return `${normalized[0]}${consonant ?? fallback}`.slice(0, 2)
  }, [])

  const getProjectDisplayId = React.useCallback((projectType: string, index: number) => {
    const year = getTrustedCurrentYear()
    return `${getProjectTypeCode(projectType)}-${year}${String(index + 1).padStart(3, "0")}`
  }, [getProjectTypeCode])

  const getStableProjectIndex = React.useCallback(
    (projectId: string) =>
      [...projects]
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime()
          const rightTime = new Date(right.createdAt).getTime()

          if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
            return left.name.localeCompare(right.name)
          }

          if (Number.isNaN(leftTime)) {
            return 1
          }

          if (Number.isNaN(rightTime)) {
            return -1
          }

          if (leftTime === rightTime) {
            return left.name.localeCompare(right.name)
          }

          return leftTime - rightTime
        })
        .findIndex((project) => project.id === projectId),
    [projects]
  )

  const buildActivityItemKeys = React.useCallback(
    (items: BacklogApiItem[], projectType: string) => {
      const projectCode = getProjectTypeCode(projectType)
      const rootDisplayIdById = new Map<string, string>()
      const childItemsByParentId = new Map<
        string,
        Array<BacklogApiItem & { parentId: string }>
      >()

      for (const item of items) {
        if (!item.parentId) {
          rootDisplayIdById.set(item.id, `${projectCode}-${item.sequenceNumber}`)
          continue
        }

        const siblings = childItemsByParentId.get(item.parentId) ?? []
        siblings.push(item as BacklogApiItem & { parentId: string })
        childItemsByParentId.set(item.parentId, siblings)
      }

      for (const siblings of childItemsByParentId.values()) {
        siblings.sort((left, right) => left.sequenceNumber - right.sequenceNumber)
      }

      return new Map(
        items.map((item) => {
          if (!item.parentId) {
            return [item.id, rootDisplayIdById.get(item.id) ?? `${projectCode}-${item.sequenceNumber}`]
          }

          const siblings = childItemsByParentId.get(item.parentId) ?? []
          const siblingIndex = siblings.findIndex((sibling) => sibling.id === item.id)
          const parentDisplayId =
            rootDisplayIdById.get(item.parentId) ?? `${projectCode}-${item.sequenceNumber}`

          return [item.id, `${parentDisplayId} / ST-${Math.max(siblingIndex + 1, 1)}`]
        })
      )
    },
    [getProjectTypeCode]
  )

  const projectDisplayIds = React.useMemo(() => {
    return new Map(
      projects.map((project) => [
        project.id,
        getProjectDisplayId(
          project.projectType,
          Math.max(getStableProjectIndex(project.id), 0)
        ),
      ])
    )
  }, [getProjectDisplayId, getStableProjectIndex, projects])

  const activities = React.useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]))
    const itemsByProjectId = new Map<string, BacklogApiItem[]>()

    for (const item of activityItems) {
      const projectId = item.projectId ?? ""
      const items = itemsByProjectId.get(projectId) ?? []
      items.push(item)
      itemsByProjectId.set(projectId, items)
    }

    const itemKeysByProjectId = new Map<string, Map<string, string>>()

    for (const [projectId, items] of itemsByProjectId.entries()) {
      const project = projectById.get(projectId)

      if (!project) {
        continue
      }

      const sortedItems = [...items].sort(
        (left, right) =>
          new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime()
      )

      itemKeysByProjectId.set(projectId, buildActivityItemKeys(sortedItems, project.projectType))
    }

    return activityItems
      .reduce<DashboardActivity[]>((entries, item) => {
        const project = projectById.get(item.projectId ?? "")

        if (!project) {
          return entries
        }

        const itemKeys = itemKeysByProjectId.get(project.id)

        entries.push({
          id: item.id,
          title: item.title,
          action: item.assigneeId && currentUserAssigneeIds.has(item.assigneeId)
            ? "Assigned"
            : "Created",
          createdAt: item.createdAt ?? new Date(0).toISOString(),
          itemKey:
            itemKeys?.get(item.id) ??
            `${projectDisplayIds.get(project.id) ?? getProjectDisplayId(project.projectType, 0)}-1`,
          isSubtask: Boolean(item.parentId),
          projectId: project.id,
          projectName: project.name,
          projectMember: project.members[0] ?? "NA",
        })

        return entries
      }, [])
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
  }, [
    activityItems,
    buildActivityItemKeys,
    currentUserAssigneeIds,
    getProjectDisplayId,
    projectDisplayIds,
    projects,
  ])

  React.useEffect(() => {
    setHasHydrated(true)
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
    setActivityItems(initialActivities)
  }, [initialActivities])

  React.useEffect(() => {
    cacheDashboardProjects(initialProjects)
    setProjects(initialProjects)

    const syncProjects = () => {
      setProjects(getDashboardProjects())
    }

    window.addEventListener("storage", syncProjects)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjects)

    return () => {
      window.removeEventListener("storage", syncProjects)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjects)
    }
  }, [initialProjects])

  React.useEffect(() => {
    const unsubscribe = subscribeToDashboardActivitySync(({ itemId, assigneeId }) => {
      setActivityItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                assigneeId,
              }
            : item
        )
      )
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const workedOnActivities = React.useMemo(() => activities, [activities])

  const assignedActivities = React.useMemo(
    () => activities.filter((activity) => activity.action === "Assigned"),
    [activities]
  )

  const viewedActivities = React.useMemo(
    () => activities.filter((activity) => activity.action === "Viewed"),
    [activities]
  )

  const recentProjects = React.useMemo(() => {
    return projects
  }, [projects])

  const starredProjects = React.useMemo(
    () => projects.filter((project) => project.starred),
    [projects]
  )

  const handleToggleStarred = React.useCallback(async (projectId: string, starred: boolean) => {
    const updatedProject = await setDashboardProjectStarred(projectId, starred)
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === updatedProject.id ? updatedProject : project
      )
    )
  }, [])

  React.useEffect(() => {
    writeDashboardHomeState({
      recentProjectsCount: recentProjects.length,
      workedOnCount: workedOnActivities.length,
    })
  }, [recentProjects.length, workedOnActivities.length])

  const oneMonthAgo = React.useMemo(() => {
    const date = getTrustedNowDate()
    date.setMonth(date.getMonth() - 1)
    return date
  }, [])

  const groupActivitiesByRecency = React.useCallback(
    (entries: DashboardActivity[]) => ({
      recent: entries.filter((entry) => new Date(entry.createdAt).getTime() >= oneMonthAgo.getTime()),
      older: entries.filter((entry) => new Date(entry.createdAt).getTime() < oneMonthAgo.getTime()),
    }),
    [oneMonthAgo]
  )

  const formatActivityDate = React.useCallback((value: string) => {
    return formatTrustedDate(value)
  }, [])

  const renderActivityContent = React.useCallback(
    (entries: DashboardActivity[]) => {
      const groupedEntries = groupActivitiesByRecency(entries)

      if (entries.length === 0) {
        return (
          <div className="px-1 py-6 text-sm text-muted-foreground">
            No recent board activity yet.
          </div>
        )
      }

      const sections = [
        { title: "In the last month", items: groupedEntries.recent },
        { title: "More than a month ago", items: groupedEntries.older },
      ].filter((section) => section.items.length > 0)

      return (
        <div className="space-y-6 pt-4">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-4 rounded-lg px-1 py-1.5 transition hover:bg-slate-50 dark:hover:bg-[#242424]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-sky-300 bg-sky-50 text-sky-600 dark:border-sky-500/40 dark:bg-[#111827] dark:text-sky-300">
                        {activity.isSubtask ? (
                          <GitFork className="h-3.5 w-3.5" />
                        ) : (
                          <CheckSquare2 className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {activity.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {activity.itemKey} · {activity.projectName}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {activity.action}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatActivityDate(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )
    },
    [formatActivityDate, groupActivitiesByRecency]
  )

  const renderStarredProjectsContent = React.useCallback(() => {
    if (starredProjects.length === 0) {
      return (
        <div className="px-1 py-6 text-sm text-muted-foreground">
          No starred projects yet.
        </div>
      )
    }

    return (
      <div className="space-y-2 pt-4">
        {starredProjects.map((project, index) => (
          <div
            key={`starred-${project.id}`}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-1 py-1.5 transition hover:bg-slate-50 dark:hover:bg-[#242424]"
            onClick={() => {
              setDashboardProject(project.id)
              router.push("/dashboard/board")
            }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/40 dark:bg-[#2b2110] dark:text-amber-400">
                <Star className="h-3.5 w-3.5 fill-current" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {project.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {projectDisplayIds.get(project.id) ?? getProjectDisplayId(project.projectType, index)} · {project.projectType || "No project type"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }, [getProjectDisplayId, projectDisplayIds, router, starredProjects])

  const renderActivitySections = React.useMemo(
    () => (
      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-nowrap gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span className="border-b-2 border-blue-500 pb-2 font-medium text-blue-700 dark:text-sky-400">
              Worked on
            </span>
            <span className="pb-2">Assigned to me</span>
            <span className="pb-2">Viewed</span>
            <span className="pb-2">Starred</span>
          </div>
        </div>
        <div className="mt-[3px] h-px w-full bg-slate-200 dark:bg-slate-800" />
        {renderActivityContent(workedOnActivities)}
      </div>
    ),
    [renderActivityContent, workedOnActivities]
  )

  React.useEffect(() => {
    const container = recentProjectsScrollRef.current

    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) {
        return
      }

      const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY

      if (delta === 0) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }

      container.scrollBy({
        left: delta,
        behavior: "smooth",
      })
    }

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [recentProjects.length])

  return (
    <TooltipProvider>
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-1 pb-6 pr-6 sm:pr-8 xl:px-2 xl:pr-10">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Choose a project
              </h1>
              {canCreateProject ? (
                <Button
                  type="button"
                  className="rounded-lg px-5"
                  style={{
                    backgroundColor: "var(--brand-primary-fixed)",
                    color: "var(--brand-primary-fixed-foreground)",
                  }}
                  onClick={() => {
                    window.dispatchEvent(new Event("tracksphere-open-create-project"))
                  }}
                >
                  Create
                </Button>
              ) : null}
            </div>
            <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
              <h2 className="font-display text-lg font-semibold tracking-tight">No projects yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
               {currentUser?.role === "faculty"
                 ? "Create a new project workspace to get started. Add your student advisees and begin managing the capstone or thesis guidance."
                 : "Wait for your adviser to create the project workspace. Once it's ready, you can start managing and completing your capstone or thesis work here."}
              </p>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Recent projects
              </h2>
              <Link
                href="/dashboard/projects"
                className="text-sm font-medium text-sky-700 transition hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
              >
                View all projects
              </Link>
            </div>

            <div
              ref={recentProjectsScrollRef}
              className="overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.55)_transparent] [touch-action:pan-x] scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/80 dark:[scrollbar-color:rgba(148,163,184,0.35)_transparent] dark:[&::-webkit-scrollbar-thumb]:bg-slate-500/45 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55"
            >
              <div className="flex min-w-max gap-4 px-1 sm:px-0">
                {recentProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className="w-[220px] shrink-0 sm:w-[240px]"
                  >
                    <Card
                      className="relative flex min-h-[142px] w-full cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-[#343434] dark:bg-[#1f1f1f]"
                      onClick={() => {
                        setDashboardProject(project.id)
                        router.push("/dashboard/board")
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-600 dark:bg-sky-500" />
                      {hasHydrated ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`More options for ${project.name}`}
                              className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                              onClick={(event) => {
                                event.stopPropagation()
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-52 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                            onClick={(event) => {
                              event.stopPropagation()
                            }}
                          >
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => {
                                void handleToggleStarred(project.id, !project.starred)
                              }}
                            >
                              <Star className={project.starred ? "h-4 w-4 fill-current text-amber-500" : "h-4 w-4"} />
                              {project.starred ? "Remove from starred" : "Add to starred"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Pencil className="h-4 w-4" />
                              Edit project
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Archive className="h-4 w-4" />
                              Archive project
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" className="cursor-pointer">
                              <Trash2 className="h-4 w-4" />
                              Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 dark:text-slate-500">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      )}

                      <CardHeader className="flex-1 space-y-3 px-4 pb-3 pt-3.5">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            {projectDisplayIds.get(project.id) ?? getProjectDisplayId(project.projectType, index)}
                          </p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CardTitle
                                className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-base font-semibold tracking-tight dark:text-slate-100"
                                title={project.name}
                              >
                                {project.name}
                              </CardTitle>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{project.name}</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-sm text-slate-500 dark:text-slate-300">
                            {project.projectType || "No project type"}
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                {project.members.slice(0, 3).map((member, index) => (
                                  <Avatar
                                    key={`${project.id}-${member}`}
                                    className={`h-7 w-7 border-2 border-white ${index === 0 ? "" : "-ml-2"}`}
                                  >
                                    <AvatarFallback className="text-[10px]">
                                      {getMemberInitials(member)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {project.members.length > 3 ? (
                                  <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[10px] font-bold text-white">
                                    +{project.members.length - 3}
                                  </div>
                                ) : null}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent align="end" className="max-w-[240px]">
                              <div className="space-y-1">
                                {project.members.map((member) => (
                                  <p key={`${project.id}-tooltip-${member}`} className="text-xs">
                                    {member}
                                  </p>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {hasHydrated ? (
            <Tabs defaultValue="worked-on" className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="overflow-x-auto">
                <TabsList
                  variant="line"
                  className="flex h-auto min-w-max flex-nowrap justify-start gap-6 rounded-none p-0 text-sm"
                >
                  <TabsTrigger
                    value="worked-on"
                    className="shrink-0 whitespace-nowrap px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
                  >
                    Worked on
                  </TabsTrigger>
                  <TabsTrigger
                    value="assigned-to-me"
                    className="shrink-0 whitespace-nowrap px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
                  >
                    Assigned to me
                  </TabsTrigger>
                  <TabsTrigger
                    value="viewed"
                    className="shrink-0 whitespace-nowrap px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
                  >
                    Viewed
                  </TabsTrigger>
                  <TabsTrigger
                    value="starred"
                    className="shrink-0 whitespace-nowrap px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
                  >
                    Starred
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="mt-[-4px] h-px w-full bg-slate-200 dark:bg-slate-800" />

              <TabsContent value="worked-on">{renderActivityContent(workedOnActivities)}</TabsContent>
              <TabsContent value="assigned-to-me">{renderActivityContent(assignedActivities)}</TabsContent>
              <TabsContent value="viewed">{renderActivityContent(viewedActivities)}</TabsContent>
              <TabsContent value="starred">{renderStarredProjectsContent()}</TabsContent>
            </Tabs>
          ) : (
            renderActivitySections
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
