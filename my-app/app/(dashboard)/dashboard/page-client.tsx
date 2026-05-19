"use client"

import * as React from "react"
import Link from "next/link"
import {
  Archive,
  MoreHorizontal,
  Pencil,
  Star,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProjectMonogram } from "@/components/projects/project-monogram"

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
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import {
  type DashboardProject,
  type DashboardProjectAccessRecord,
  PROJECT_CHANGE_EVENT,
  PROJECTS_CHANGE_EVENT,
  archiveDashboardProject,
  cacheDashboardProjects,
  getDashboardProjectAccessRecords,
  getDashboardProjects,
  setDashboardProject,
  setDashboardProjectStarred,
} from "@/lib/projects"
import {
  markDashboardHomeSeenInSession,
} from "@/lib/dashboard-first-open"
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
import { writeDashboardHomeState } from "@/lib/dashboard-home-state"
import type { BacklogApiItem } from "./types"

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

type RecentProjectEntry = {
  project: DashboardProject
  accessedAt?: string
}

export function DashboardPageClient({
  initialProjects,
}: DashboardPageClientProps) {
  const router = useRouter()
  const [hasHydrated, setHasHydrated] = React.useState(false)
  const [projects, setProjects] = React.useState<DashboardProject[]>(initialProjects)
  const [projectAccessRecords, setProjectAccessRecords] = React.useState<DashboardProjectAccessRecord[]>([])
  const [currentUser, setCurrentUser] = React.useState<AuthenticatedUser | null>(null)
  const [pendingArchiveProject, setPendingArchiveProject] = React.useState<DashboardProject | null>(null)
  const canCreateProject =
    currentUser?.role && isUserRole(currentUser.role)
      ? canCreateProjectForRole(currentUser.role)
      : false

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

  React.useEffect(() => {
    setHasHydrated(true)
  }, [])

  React.useEffect(() => {
    markDashboardHomeSeenInSession()
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
    setProjects(getDashboardProjects())

    const syncProjects = () => {
      setProjects(getDashboardProjects())
      setProjectAccessRecords(getDashboardProjectAccessRecords())
    }

    syncProjects()
    window.addEventListener("storage", syncProjects)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProjects)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjects)

    return () => {
      window.removeEventListener("storage", syncProjects)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProjects)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjects)
    }
  }, [initialProjects])

  const createdProjects = React.useMemo(() => {
    return [...projects].sort((left, right) => {
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

      return rightTime - leftTime
    })
  }, [projects])

  const orderedProjectEntries = React.useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]))
    const includedProjectIds = new Set<string>()
    const accessedProjects: RecentProjectEntry[] = projectAccessRecords
      .flatMap((record) => {
        const project = projectById.get(record.projectId)
        return project ? [{ project, accessedAt: record.accessedAt }] : []
      })
      .filter((entry) => {
        if (includedProjectIds.has(entry.project.id)) {
          return false
        }

        includedProjectIds.add(entry.project.id)
        return true
      })

    const remainingProjects = createdProjects
      .filter((project) => !includedProjectIds.has(project.id))
      .map((project) => ({ project }))

    return [...accessedProjects, ...remainingProjects]
  }, [createdProjects, projectAccessRecords, projects])

  const forYouProjects = React.useMemo(() => {
    return orderedProjectEntries.slice(0, 4).map((entry) => entry.project)
  }, [orderedProjectEntries])

  const recentProjects = React.useMemo(() => {
    return orderedProjectEntries.slice(4)
  }, [orderedProjectEntries])

  const handleToggleStarred = React.useCallback(async (projectId: string, starred: boolean) => {
    const updatedProject = await setDashboardProjectStarred(projectId, starred)
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === updatedProject.id ? updatedProject : project
      )
    )
  }, [])

  const handleArchiveProject = React.useCallback((projectId: string) => {
    const archivedBy =
      currentUser?.name?.trim() ||
      currentUser?.email?.trim() ||
      currentUser?.id?.trim() ||
      undefined
    const archivedProject = archiveDashboardProject(projectId, archivedBy)

    if (archivedProject) {
      setProjects(getDashboardProjects())
      setProjectAccessRecords(getDashboardProjectAccessRecords())
    }
  }, [currentUser])

  const handleConfirmArchiveProject = React.useCallback(() => {
    if (!pendingArchiveProject) {
      return
    }

    handleArchiveProject(pendingArchiveProject.id)
    setPendingArchiveProject(null)
  }, [handleArchiveProject, pendingArchiveProject])

  React.useEffect(() => {
    writeDashboardHomeState({
      recentProjectsCount: forYouProjects.length,
      workedOnCount: recentProjects.length,
    })
  }, [forYouProjects.length, recentProjects.length])

  const oneMonthAgo = React.useMemo(() => {
    const date = getTrustedNowDate()
    date.setMonth(date.getMonth() - 1)
    return date
  }, [])

  const groupProjectsByRecency = React.useCallback(
    (entries: RecentProjectEntry[]) => ({
      recent: entries.filter((entry) => new Date(entry.accessedAt ?? entry.project.createdAt).getTime() >= oneMonthAgo.getTime()),
      older: entries.filter((entry) => new Date(entry.accessedAt ?? entry.project.createdAt).getTime() < oneMonthAgo.getTime()),
    }),
    [oneMonthAgo]
  )

  const formatProjectDate = React.useCallback((value: string) => {
    return formatTrustedDate(value)
  }, [])

  const renderCreatedProjectList = React.useCallback(
    (entries: RecentProjectEntry[]) => {
      const groupedEntries = groupProjectsByRecency(entries)

      if (entries.length === 0) {
        return (
          <div className="px-1 py-6 text-sm text-muted-foreground">
            No recent projects yet.
          </div>
        )
      }

      const sections = [
        { title: "In the last month", items: groupedEntries.recent },
        { title: "More than a month ago", items: groupedEntries.older },
      ].filter((section) => section.items.length > 0)

      return (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((entry) => {
                  const { project } = entry
                  const dateLabel = entry.accessedAt ? "Opened" : "Created"

                  return (
                    <div
                      key={project.id}
                      className="flex w-full items-start justify-between gap-4 rounded-lg px-1 py-1.5 transition hover:bg-slate-50 dark:hover:bg-[#242424]"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => {
                          setDashboardProject(project.id)
                          router.push("/dashboard/board")
                        }}
                      >
                        <ProjectMonogram
                          name={project.name}
                          seed={project.id}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {project.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {projectDisplayIds.get(project.id) ?? "PJ-000"} - {project.projectType || "No project type"}
                          </p>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-start gap-2">
                        <button
                          type="button"
                          className="text-right"
                          onClick={() => {
                            setDashboardProject(project.id)
                            router.push("/dashboard/board")
                          }}
                        >
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {dateLabel}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatProjectDate(entry.accessedAt ?? project.createdAt)}
                          </p>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`More options for ${project.name}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-52 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
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
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => {
                                setPendingArchiveProject(project)
                              }}
                            >
                              <Archive className="h-4 w-4" />
                              Archive project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )
    },
    [formatProjectDate, groupProjectsByRecency, handleToggleStarred, projectDisplayIds, router]
  )

  const renderRecentProjectSections = React.useMemo(
    () => (
      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Recent projects
        </h2>
        <div className="mt-3">
          {renderCreatedProjectList(recentProjects)}
        </div>
      </div>
    ),
    [recentProjects, renderCreatedProjectList]
  )
  return (
    <TooltipProvider>
      <div className="w-full">
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
                For you
              </h2>
              <Link
                href="/dashboard/projects"
                className="text-sm font-medium text-sky-700 transition hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
              >
                View all projects
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {forYouProjects.map((project, index) => (
                <div
                  key={project.id}
                  className="w-full"
                >
                    <Card
                      className="relative flex min-h-[124px] w-full cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-[#343434] dark:bg-[#1f1f1f]"
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
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => {
                                setPendingArchiveProject(project)
                              }}
                            >
                              <Archive className="h-4 w-4" />
                              Archive project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 dark:text-slate-500">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      )}

                      <CardHeader className="flex-1 space-y-2 px-4 pb-2.5 pt-3">
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
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            {project.projectType || "No project type"}
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                {project.members.slice(0, 4).map((member, index) => (
                                  <Avatar
                                    key={`${project.id}-${member}`}
                                    className={`h-7 w-7 border-2 border-white ${index === 0 ? "" : "-ml-2"}`}
                                  >
                                    <AvatarFallback className="text-[10px]">
                                      {getMemberInitials(member)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
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
          </section>

          {renderRecentProjectSections}
        </div>
      </div>

      <AlertDialog
        open={pendingArchiveProject !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingArchiveProject(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 dark:border-[#343434] dark:bg-[#262626]">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <AlertDialogTitle>
                Archive Project {pendingArchiveProject?.name}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 pt-2">
              <span className="block">
                This project will be archived and removed from your active dashboard project lists. You won&apos;t be able to open it while it is archived.
              </span>
              <span className="block">
                You can restore this project later from Archives.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-amber-400 text-white hover:bg-amber-300"
              onClick={handleConfirmArchiveProject}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
