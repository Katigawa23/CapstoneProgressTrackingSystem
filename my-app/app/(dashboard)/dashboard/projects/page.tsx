"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  type DashboardProject,
  getDashboardProjects,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
} from "@/lib/projects"

function getLeadName(project: DashboardProject) {
  return project.members[0] ?? "Unassigned"
}

function getMemberInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

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

export default function DashboardProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")

  const projectDisplayIds = React.useMemo(
    () =>
      new Map(
        projects.map((project, index) => [
          project.id,
          `${getProjectTypeCode(project.projectType)}-${index + 1}`,
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
      const leadName = getLeadName(project)

      return [
        project.name,
        project.id,
        projectDisplayIds.get(project.id) ?? "",
        project.projectType,
        leadName,
        project.program,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [projectDisplayIds, projects, searchQuery])

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 overflow-auto pb-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Projects
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Open any project workspace from the list below.
        </p>
      </div>

      <div className="max-w-[220px]">
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
                <th className="px-3 py-2 font-semibold">Lead</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No projects found.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const leadName = getLeadName(project)

                  return (
                    <tr
                      key={project.id}
                      className="cursor-pointer border-t border-slate-200 transition hover:bg-sky-50/60 dark:border-[#343434] dark:hover:bg-[#242424]"
                      onClick={() => {
                        setDashboardProject(project.id)
                        router.push("/dashboard/board")
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-display text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          {project.name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                        {projectDisplayIds.get(project.id) ?? project.id}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {project.projectType || "No project type"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-sky-100 text-[9px] font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                              {getMemberInitials(leadName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-slate-700 dark:text-slate-300">{leadName}</span>
                        </div>
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
  )
}
