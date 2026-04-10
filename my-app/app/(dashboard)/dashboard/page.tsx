"use client"

import * as React from "react"
import Link from "next/link"
import { CheckSquare2 } from "lucide-react"
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
  getDashboardProjects,
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
  projectId: string
  projectName: string
  projectMember: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])
  const [activities, setActivities] = React.useState<DashboardActivity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(true)

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
        `${getProjectTypeCode(project.projectType)}-${index + 1}`,
      ])
    )
  }, [getProjectTypeCode, projects])

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

            return sortedItems.map((item, index) => ({
              id: item.id,
              title: item.title,
              action: item.assigneeId ? "Assigned" : "Created",
              createdAt: item.createdAt ?? new Date(0).toISOString(),
              itemKey: `${projectDisplayIds.get(project.id) ?? getProjectTypeCode(project.projectType)}-${index + 1}`,
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
  }, [getProjectTypeCode, projectDisplayIds, projects])

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
                        <CheckSquare2 className="h-3.5 w-3.5" />
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
    [formatActivityDate, getMemberInitials, groupActivitiesByRecency, isLoadingActivities]
  )

  return (
    <TooltipProvider>
      <ScrollArea className="h-full w-full">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-6 pr-8 sm:pr-10">
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

          <div className="flex flex-wrap gap-4">
            {projects.map((project, index) => (
              <Card
                key={project.id}
                className="relative flex min-h-[142px] w-full max-w-[220px] cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-[#343434] dark:bg-[#1f1f1f]"
                onClick={() => {
                  setDashboardProject(project.id)
                  router.push("/dashboard/board")
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-600 dark:bg-sky-500" />

                <CardHeader className="flex-1 space-y-3 px-4 pb-3 pt-3.5">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {projectDisplayIds.get(project.id) ??
                        `${getProjectTypeCode(project.projectType)}-${index + 1}`}
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
