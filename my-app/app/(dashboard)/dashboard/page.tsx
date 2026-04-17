"use client"

import * as React from "react"
import Link from "next/link"
import { CheckSquare2, GitFork } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  getSelectedDashboardProjectId,
  getDashboardProjects,
  PROJECT_CHANGE_EVENT,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
} from "@/lib/projects"
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

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])
  const [activities, setActivities] = React.useState<DashboardActivity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(true)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null)

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
    const year = new Date().getFullYear()
    return `${getProjectTypeCode(projectType)}-${year}${String(index + 1).padStart(3, "0")}`
  }, [getProjectTypeCode])

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
    const sortedProjects = [...projects].sort((left, right) => {
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

    return new Map(
      sortedProjects.map((project, index) => [
        project.id,
        getProjectDisplayId(project.projectType, index),
      ])
    )
  }, [getProjectDisplayId, projects])

  React.useEffect(() => {
    const syncProjects = () => {
      setProjects(getDashboardProjects())
    }

    syncProjects()
    void refreshDashboardProjects()
      .then((nextProjects) => {
        setProjects(nextProjects)
      })
      .catch((error) => {
        console.error("Failed to refresh projects", error)
      })

    window.addEventListener("storage", syncProjects)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjects)

    return () => {
      window.removeEventListener("storage", syncProjects)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjects)
    }
  }, [])

  React.useEffect(() => {
    const syncSelectedProject = () => {
      setSelectedProjectId(getSelectedDashboardProjectId())
    }

    syncSelectedProject()
    window.addEventListener("storage", syncSelectedProject)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncSelectedProject)

    return () => {
      window.removeEventListener("storage", syncSelectedProject)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncSelectedProject)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    async function loadActivities() {
      if (projects.length === 0) {
        setActivities([])
        setIsLoadingActivities(false)
        return
      }

      setIsLoadingActivities(true)

      try {
        const responses = await Promise.all(
          projects.map(async (project) => {
            const response = await fetch(`/api/backlog-items?projectId=${project.id}`, {
              cache: "no-store",
            })

            if (!response.ok) {
              throw new Error(`Failed to load backlog items for project ${project.id}`)
            }

            const data = (await response.json()) as { items: BacklogApiItem[] }

            const sortedItems = [...data.items].sort((left, right) => {
              const leftTime = new Date(left.createdAt ?? 0).getTime()
              const rightTime = new Date(right.createdAt ?? 0).getTime()

              return leftTime - rightTime
            })
            const itemKeys = buildActivityItemKeys(sortedItems, project.projectType)

            return sortedItems.map((item) => ({
              id: item.id,
              title: item.title,
              action: item.assigneeId ? "Assigned" : "Created",
              createdAt: item.createdAt ?? new Date(0).toISOString(),
              itemKey:
                itemKeys.get(item.id) ??
                `${projectDisplayIds.get(project.id) ?? getProjectDisplayId(project.projectType, 0)}-1`,
              isSubtask: Boolean(item.parentId),
              projectId: project.id,
              projectName: project.name,
              projectMember: project.members[0] ?? "NA",
            })) satisfies DashboardActivity[]
          })
        )

        if (!cancelled) {
          setActivities(
            responses
              .flat()
              .sort(
                (left, right) =>
                  new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
              )
          )
        }
      } catch (error) {
        console.error("Failed to load dashboard activities", error)
        if (!cancelled) {
          setActivities([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingActivities(false)
        }
      }
    }

    void loadActivities()

    return () => {
      cancelled = true
    }
  }, [buildActivityItemKeys, getProjectDisplayId, projectDisplayIds, projects])

  const workedOnActivities = React.useMemo(
    () => activities,
    [activities]
  )

  const assignedActivities = React.useMemo(
    () => activities.filter((activity) => activity.action === "Assigned"),
    [activities]
  )

  const viewedActivities = React.useMemo(
    () => activities.filter((activity) => activity.action === "Viewed"),
    [activities]
  )

  const starredActivities = React.useMemo(
    () =>
      activities.filter((activity) => {
        const starredProjectId = projects[0]?.id
        return activity.projectId === starredProjectId
      }),
    [activities, projects]
  )

  const recentProjects = React.useMemo(() => {
    if (!selectedProjectId) {
      return projects
    }

    return [...projects].sort((left, right) => {
      if (left.id === selectedProjectId) {
        return -1
      }

      if (right.id === selectedProjectId) {
        return 1
      }

      return 0
    })
  }, [projects, selectedProjectId])

  const oneMonthAgo = React.useMemo(() => {
    const date = new Date()
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
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date)
  }, [])

  const renderActivityContent = React.useCallback(
    (entries: DashboardActivity[]) => {
      const groupedEntries = groupActivitiesByRecency(entries)

      if (isLoadingActivities) {
        return (
          <div className="px-1 py-6 text-sm text-muted-foreground">Loading recent work...</div>
        )
      }

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
    [formatActivityDate, groupActivitiesByRecency, isLoadingActivities]
  )

  return (
    <TooltipProvider>
      <ScrollArea className="h-full w-full">
        <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-1 pb-6 pr-6 sm:pr-8 xl:px-2 xl:pr-10">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Choose a project</h1>
            <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />
          </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
            <h2 className="font-display text-lg font-semibold tracking-tight">No projects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a new project from the sidebar menu to start your thesis workspace.
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

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {recentProjects.map((project, index) => (
              <Card
                key={project.id}
                className="relative flex min-h-[142px] w-full cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-[#343434] dark:bg-[#1f1f1f]"
                onClick={() => {
                  setDashboardProject(project.id)
                  router.push("/dashboard/board")
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-600 dark:bg-sky-500" />

                <CardHeader className="flex-1 space-y-3 px-4 pb-3 pt-3.5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {projectDisplayIds.get(project.id) ?? getProjectDisplayId(project.projectType, index)}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle
                          className="font-display truncate text-base font-semibold tracking-tight dark:text-slate-100"
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
                    <div className="flex items-center">
                      {project.members.slice(0, 3).map((member, index) => (
                        <Avatar
                          key={`${project.id}-${member}`}
                          className={`h-7 w-7 border-2 border-white ${
                            index === 0 ? "" : "-ml-2"
                          }`}
                        >
                          <AvatarFallback className="bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-[#2a2a2a] dark:text-slate-200">
                            {getMemberInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Tabs defaultValue="worked-on" className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <TabsList
            variant="line"
            className="h-auto flex-wrap justify-start gap-6 rounded-none p-0 text-sm"
          >
            <TabsTrigger
              value="worked-on"
              className="px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
            >
              Worked on
            </TabsTrigger>
            <TabsTrigger
              value="assigned-to-me"
              className="px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
            >
              Assigned to me
            </TabsTrigger>
            <TabsTrigger
              value="viewed"
              className="px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
            >
              Viewed
            </TabsTrigger>
            <TabsTrigger
              value="starred"
              className="px-0 pb-0.5 pt-4 hover:text-blue-700 data-[state=active]:text-blue-700 after:bottom-[2px] after:bg-blue-500"
            >
              Starred
            </TabsTrigger>
          </TabsList>
          <div className="mt-[-4px] h-px w-full bg-slate-200 dark:bg-slate-800" />

          <TabsContent value="worked-on">{renderActivityContent(workedOnActivities)}</TabsContent>
          <TabsContent value="assigned-to-me">{renderActivityContent(assignedActivities)}</TabsContent>
          <TabsContent value="viewed">{renderActivityContent(viewedActivities)}</TabsContent>
          <TabsContent value="starred">{renderActivityContent(starredActivities)}</TabsContent>
        </Tabs>
      </div>
      </ScrollArea>
    </TooltipProvider>
  )
}
