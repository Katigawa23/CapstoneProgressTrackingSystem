"use client"

import * as React from "react"
import { ArchiveRestore, ChevronDown, Ellipsis, Filter, FolderArchive, Search } from "lucide-react"

import { ProjectMonogram } from "@/components/projects/project-monogram"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type DashboardArchivedProject,
  PROJECTS_CHANGE_EVENT,
  getArchivedDashboardProjects,
  getDashboardProjectCode,
  restoreArchivedDashboardProject,
} from "@/lib/projects"
import { formatTrustedDate, getTrustedCurrentYear } from "@/lib/trusted-time"

type ArchivedProjectGroup = {
  id: string
  label: string
  projects: DashboardArchivedProject[]
}

function getStartOfDay(value: Date) {
  const nextDate = new Date(value)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function getArchivedGroupId(archivedAt?: string | null) {
  if (!archivedAt) {
    return "unknown"
  }

  const archivedDate = new Date(archivedAt)

  if (Number.isNaN(archivedDate.getTime())) {
    return "unknown"
  }

  const today = getStartOfDay(new Date())
  const archivedDay = getStartOfDay(archivedDate)
  const diffDays = Math.floor(
    (today.getTime() - archivedDay.getTime()) / (24 * 60 * 60 * 1000)
  )

  if (diffDays <= 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays <= 7) return "last-week"
  if (diffDays <= 31) return "last-month"
  return "older"
}

const archiveGroupLabels: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-week": "Last week",
  "last-month": "Last month",
  older: "Older",
  unknown: "Unknown date",
}

const archiveGroupOrder = [
  "today",
  "yesterday",
  "last-week",
  "last-month",
  "older",
  "unknown",
]

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export default function DashboardProjectArchivePage() {
  const [searchValue, setSearchValue] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [archivedProjects, setArchivedProjects] = React.useState<DashboardArchivedProject[]>([])
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<string[]>([])

  const syncArchivedProjects = React.useCallback(() => {
    setArchivedProjects(getArchivedDashboardProjects())
  }, [])

  React.useEffect(() => {
    syncArchivedProjects()
    window.addEventListener("storage", syncArchivedProjects)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncArchivedProjects)

    return () => {
      window.removeEventListener("storage", syncArchivedProjects)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncArchivedProjects)
    }
  }, [syncArchivedProjects])

  const projectKeys = React.useMemo(() => {
    return new Map(
      archivedProjects.map((project, index) => [
        project.id,
        `${getDashboardProjectCode(project)}-${getTrustedCurrentYear()}${String(index + 1).padStart(3, "0")}`,
      ])
    )
  }, [archivedProjects])

  const visibleProjects = React.useMemo(() => {
    const query = searchValue.trim().toLowerCase()

    if (!query) {
      return archivedProjects
    }

    return archivedProjects.filter((project) =>
      [
        projectKeys.get(project.id) ?? getDashboardProjectCode(project),
        project.name,
        project.projectType || "No project type",
        project.archivedBy ?? "Unknown user",
      ]
        .some((value) => value.toLowerCase().includes(query))
    )
  }, [archivedProjects, projectKeys, searchValue])
  const allVisibleIds = visibleProjects.map((project) => project.id)
  const allVisibleSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.includes(id))
  const someVisibleSelected =
    allVisibleIds.some((id) => selectedIds.includes(id)) && !allVisibleSelected
  const archiveGroups = React.useMemo<ArchivedProjectGroup[]>(() => {
    const projectsByGroup = new Map<string, DashboardArchivedProject[]>()

    for (const project of visibleProjects) {
      const groupId = getArchivedGroupId(project.archivedAt)
      const groupProjects = projectsByGroup.get(groupId) ?? []
      groupProjects.push(project)
      projectsByGroup.set(groupId, groupProjects)
    }

    return archiveGroupOrder
      .map((groupId) => ({
        id: groupId,
        label: archiveGroupLabels[groupId] ?? groupId,
        projects: projectsByGroup.get(groupId) ?? [],
      }))
      .filter((group) => group.projects.length > 0)
  }, [visibleProjects])
  const handleRestoreProject = React.useCallback(
    (projectId: string) => {
      restoreArchivedDashboardProject(projectId)
      setSelectedIds((current) => current.filter((id) => id !== projectId))
      syncArchivedProjects()
    },
    [syncArchivedProjects]
  )

  const toggleArchiveGroup = React.useCallback((groupId: string) => {
    setCollapsedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    )
  }, [])

  return (
    <TooltipProvider>
      <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Archived projects</h1>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            View archived project workspaces from the dashboard.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          <div className="relative min-w-0 flex-1 sm:w-[220px] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs"
              placeholder="Search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:bg-[#303030] dark:hover:text-slate-100"
            aria-label="Filter archived projects"
            title="Filter"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-xs dark:border-[#343434] dark:bg-[#1f1f1f]">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-9" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[17%]" />
              <col className="w-[20%]" />
              <col className="w-16" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#343434] dark:bg-[#202020]">
              <tr className="text-left">
                <th className="w-9 px-2.5 py-2">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked ? allVisibleIds : [])
                    }}
                    aria-label="Select all archived projects"
                  />
                </th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Key</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Date archived</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Archived by</th>
                <th className="w-11 px-2 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archiveGroups.map((group) => (
                <React.Fragment key={group.id}>
                  <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-[#343434] dark:bg-[#202020]">
                    <td colSpan={7} className="px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-[2px] text-sm font-medium text-slate-700 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-200 dark:hover:text-white"
                        onClick={() => toggleArchiveGroup(group.id)}
                        aria-expanded={!collapsedGroupIds.includes(group.id)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${
                            collapsedGroupIds.includes(group.id) ? "-rotate-90" : ""
                          }`}
                        />
                        <span>{group.label} ({group.projects.length})</span>
                      </button>
                    </td>
                  </tr>

                  {collapsedGroupIds.includes(group.id) ? null : group.projects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-[#343434] dark:hover:bg-[#242424]"
                    >
                      <td className="px-2.5 py-2 align-middle">
                        <Checkbox
                          checked={selectedIds.includes(project.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((current) =>
                              checked
                                ? [...current, project.id]
                                : current.filter((id) => id !== project.id)
                            )
                          }}
                          aria-label={`Select ${project.name}`}
                        />
                      </td>
                      <td className="px-2 py-2 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1.5">
                            <FolderArchive className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
                          <span>{projectKeys.get(project.id) ?? getDashboardProjectCode(project)}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-[#303030] dark:text-slate-300">
                          {project.projectType || "No project type"}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-2 py-2 align-middle text-sm text-slate-700 dark:text-slate-200">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProjectMonogram name={project.name} seed={project.id} />
                          <span className="truncate whitespace-nowrap" title={project.name}>
                            {project.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="inline-flex rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 dark:border-[#4a4a4a] dark:text-slate-200">
                          {formatTrustedDate(project.archivedAt)}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle text-sm text-slate-700 dark:text-slate-200">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(project.archivedBy ?? "Unknown user") || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="max-w-[140px] truncate">
                                {project.archivedBy ?? "Unknown user"}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{project.archivedBy ?? "Unknown user"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-2 py-2 align-middle text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                              aria-label={`Open actions for ${project.name}`}
                              title="Actions"
                            >
                              <Ellipsis className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-36 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onSelect={() => {
                                handleRestoreProject(project.id)
                              }}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {visibleProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No archived projects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-2 text-center text-sm text-slate-500 dark:border-[#343434] dark:text-slate-400">
          {visibleProjects.length} of {archivedProjects.length}
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}
