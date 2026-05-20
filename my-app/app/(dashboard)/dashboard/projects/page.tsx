"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { ProjectMonogram } from "@/components/projects/project-monogram"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type DashboardProject,
  getDashboardProjects,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
} from "@/lib/projects"
import { getTrustedCurrentYear } from "@/lib/trusted-time"

function sortProjects(projects: DashboardProject[]) {
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
}

function getStableProjectIndex(projects: DashboardProject[], projectId: string) {
  return [...projects]
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
    .findIndex((project) => project.id === projectId)
}

function getProjectTypeCode(projectType: string) {
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
}

function getProjectDisplayId(projectType: string, index: number) {
  const year = getTrustedCurrentYear()
  return `${getProjectTypeCode(projectType)}-${year}${String(index + 1).padStart(3, "0")}`
}

function getProjectAdvisers(project: DashboardProject) {
  const advisers = [
    project.ownerName?.trim() ||
      project.ownerEmail?.trim() ||
      project.ownerUserId?.trim() ||
      "",
    ...project.advisers,
  ]

  return advisers.filter((adviser, index) => {
    const normalizedAdviser = adviser.trim().toLowerCase()

    if (!normalizedAdviser) {
      return false
    }

    return advisers.findIndex((candidate) => candidate.trim().toLowerCase() === normalizedAdviser) === index
  })
}

function getProjectAdviser(project: DashboardProject) {
  return getProjectAdvisers(project)[0] ?? ""
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function ProjectAdviserAvatar({ project }: { project: DashboardProject }) {
  const adviserName = getProjectAdviser(project)
  const adviserEmail = project.ownerEmail?.trim() ?? ""

  if (!adviserName) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[var(--brand-primary-fixed)] text-[10px] font-semibold text-white dark:bg-[var(--brand-primary-fixed)]">
            {getInitials(adviserName)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            Adviser
          </p>
          <p className="text-xs">{adviserName}</p>
          {adviserEmail && adviserEmail !== adviserName ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{adviserEmail}</p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function ProjectPeopleIndicator({
  emptyLabel,
  people,
}: {
  emptyLabel: string
  people: string[]
}) {
  if (people.length === 0) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center">
          {people.slice(0, 4).map((person, index) => (
            <Avatar
              key={`${emptyLabel}-${person}`}
              className={`h-7 w-7 border-2 border-white dark:border-[#1f1f1f] ${
                index === 0 ? "" : "-ml-2"
              }`}
            >
              <AvatarFallback className="bg-[var(--brand-primary-fixed)] text-[10px] font-semibold text-white dark:bg-[var(--brand-primary-fixed)]">
                {getInitials(person)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            {emptyLabel}
          </p>
          {people.map((person) => (
            <p key={`${emptyLabel}-${person}`} className="text-xs">
              {person}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default function DashboardProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")

  const projectDisplayIds = React.useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          getProjectDisplayId(
            project.projectType,
            Math.max(getStableProjectIndex(projects, project.id), 0)
          ),
        ])
      ),
    [projects]
  )

  React.useEffect(() => {
    const syncProjects = () => {
      setProjects(sortProjects(getDashboardProjects()))
    }

    syncProjects()
    void refreshDashboardProjects()
      .then((nextProjects) => {
        setProjects(sortProjects(nextProjects))
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

  const filteredProjects = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return projects
    }

    return projects.filter((project) => {
      return [
        project.name,
        project.id,
        projectDisplayIds.get(project.id) ?? "",
        project.projectType,
        project.members.join(" "),
        getProjectAdviser(project),
        project.program,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [projectDisplayIds, projects, searchQuery])

  return (
    <TooltipProvider>
      <div className="mx-auto flex h-full w-full max-w-[92rem] flex-col gap-4 overflow-auto pb-6">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Projects
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Open any project workspace from the list below.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search projects"
              className="h-8 rounded-sm border-slate-200 bg-white pl-8 text-xs dark:border-[#343434] dark:bg-[#242424] dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f] dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:bg-[#242424] dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Key</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Member</th>
                  <th className="px-3 py-2 font-semibold">Adviser</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => {
                    return (
                      <tr
                        key={project.id}
                        className="cursor-pointer border-t border-slate-200 transition hover:bg-[color:rgba(var(--brand-primary-rgb),0.06)] dark:border-[#343434] dark:hover:bg-[#242424]"
                        onClick={() => {
                          setDashboardProject(project.id)
                          router.push("/dashboard/board")
                        }}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <ProjectMonogram name={project.name} seed={project.id} />
                            <div className="font-display text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                              {project.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {projectDisplayIds.get(project.id) ?? project.id}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {project.projectType || "No project type"}
                        </td>
                        <td className="px-3 py-2.5">
                          <ProjectPeopleIndicator emptyLabel="Members" people={project.members} />
                        </td>
                        <td className="px-3 py-2.5">
                          <ProjectAdviserAvatar project={project} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
