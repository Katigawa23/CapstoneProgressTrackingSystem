"use client"

import * as React from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])

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

  return (
    <TooltipProvider>
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-auto pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a project</h1>
          <div className="mt-3 h-px w-full bg-slate-200" />
        </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new project from the sidebar menu to start your thesis workspace.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        {projects.map((project, index) => (
          <Card
            key={project.id}
            className="relative flex min-h-[142px] w-full max-w-[220px] cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            onClick={() => {
              setDashboardProject(project.id)
              router.push("/dashboard/board")
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />

            <CardHeader className="flex-1 space-y-3 px-4 pb-3 pt-3.5">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  {projectDisplayIds.get(project.id) ??
                    `${getProjectTypeCode(project.projectType)}-${index + 1}`}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle
                      className="truncate text-base font-semibold font-sans"
                      title={project.name}
                    >
                      {project.name}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{project.name}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-sm text-slate-500">
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
                      <AvatarFallback className="bg-slate-100 text-[10px] font-medium text-slate-600">
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

      <Tabs defaultValue="worked-on" className="border-t border-slate-200 pt-4">
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
        <div className="mt-[-4px] h-px w-full bg-slate-200" />
      </Tabs>
    </div>
    </TooltipProvider>
  )
}
