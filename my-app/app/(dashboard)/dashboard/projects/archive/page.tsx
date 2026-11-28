"use client"

import * as React from "react"
import Link from "next/link"
import { ArchiveRestore, ArrowLeft, FolderArchive, Search } from "lucide-react"

import { ProjectMonogram } from "@/components/projects/project-monogram"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type DashboardArchivedProject,
  getDashboardProjectCode,
} from "@/lib/projects"
import { formatTrustedDate, getTrustedCurrentYear } from "@/lib/trusted-time"

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
  const [pendingRestore, setPendingRestore] = React.useState<DashboardArchivedProject[]>([])
  const [restoring, setRestoring] = React.useState(false)
  const restoreInFlight = React.useRef(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  const syncArchivedProjects = React.useCallback(async () => {
    const response = await fetch("/api/projects/archive", { cache: "no-store" })
    const payload = (await response.json().catch(() => ({}))) as {
      projects?: DashboardArchivedProject[]
      error?: string
    }
    if (!response.ok) {
      setErrorMessage(payload.error ?? "Failed to load archived projects.")
      return
    }
    setErrorMessage("")
    setArchivedProjects(Array.isArray(payload.projects) ? payload.projects : [])
  }, [])

  React.useEffect(() => {
    void syncArchivedProjects()
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
  const selectedProjects = visibleProjects.filter((project) => selectedIds.includes(project.id))
  const handleRestoreProject = React.useCallback(
    async (projectId: string) => {
      const requestRestore = async (memberIds: string[]) => {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transferMemberUserIds: memberIds }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          code?: string
          conflictingUserIds?: string[]
        }
        return { response, payload }
      }

      let { response, payload } = await requestRestore([])
      if (
        response.status === 409 &&
        payload.code === "ACTIVE_GROUP_CONFLICT" &&
        Array.isArray(payload.conflictingUserIds)
      ) {
        const confirmed = window.confirm(
          "Some students are already in another active group. Restore this group and transfer those students back?"
        )
        if (!confirmed) return false
        ;({ response, payload } = await requestRestore(payload.conflictingUserIds))
      }
      if (!response.ok) throw new Error(payload.error ?? "Failed to restore project.")
      return true
    },
    []
  )

  const confirmRestore = async () => {
    if (restoreInFlight.current || !pendingRestore.length) return
    restoreInFlight.current = true
    setRestoring(true)
    setPendingRestore([])
    setErrorMessage("")
    const restoredIds = new Set<string>()
    const errors: string[] = []

    try {
      for (const project of pendingRestore) {
        try {
          if (await handleRestoreProject(project.id)) restoredIds.add(project.id)
        } catch (error) {
          errors.push(`${project.name} ? ${error instanceof Error ? error.message : "Restore failed."}`)
        }
      }
      setArchivedProjects((current) => current.filter((project) => !restoredIds.has(project.id)))
      setSelectedIds((current) => current.filter((id) => !restoredIds.has(id)))
      if (errors.length) setErrorMessage(errors.join(" "))
    } finally {
      restoreInFlight.current = false
      setRestoring(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-950 dark:border-[var(--border)] dark:bg-[var(--card)] dark:text-slate-200 dark:hover:bg-[var(--surface-hover)] dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Archived projects</h1>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            View archived project workspaces from the dashboard.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          {selectedProjects.length > 0 ? (
            <Button size="sm" disabled={restoring} onClick={() => setPendingRestore(selectedProjects)}>
              <ArchiveRestore className="size-4" />
              Restore selected ({selectedProjects.length})
            </Button>
          ) : null}
          <div className="relative min-w-0 flex-1 sm:w-[220px] sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs"
              placeholder="Search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>

        </div>
      </div>

      <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-xs dark:border-[var(--border)] dark:bg-[var(--card)]">
        {errorMessage ? (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}
        <div className="max-w-full overflow-x-auto" role="region" aria-label="Archived projects table" tabIndex={0}>
          <table className="w-full min-w-[40rem] table-fixed border-collapse">
            <colgroup>
              <col className="w-9" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[17%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[var(--border)] dark:bg-[var(--card)]">
              <tr className="text-left">
                <th className="w-9 px-2.5 py-2">
                  <Checkbox
                    disabled={restoring || !allVisibleIds.length}
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked ? allVisibleIds : [])
                    }}
                    aria-label="Select all archived projects"
                  />
                </th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Task ID</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Date archived</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Archived by</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-[var(--border)] dark:hover:bg-[var(--surface-hover)]"
                >
                  <td className="px-2.5 py-2 align-middle">
                    <Checkbox
                      disabled={restoring}
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
                    <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-[var(--surface-hover)] dark:text-slate-300">
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
                    <span className="inline-flex rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 dark:border-[var(--input)] dark:text-slate-200">
                      {formatTrustedDate(project.archivedAt)}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-middle text-sm text-slate-700 dark:text-slate-200">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-2">
                          <Avatar name={project.archivedBy ?? "Unknown user"} className="h-7 w-7">
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
                </tr>
              ))}

              {visibleProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No archived projects yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-2 text-center text-sm text-slate-500 dark:border-[var(--border)] dark:text-slate-400">
          {visibleProjects.length} of {archivedProjects.length}
        </div>
      </div>
      </div>
      <AlertDialog open={pendingRestore.length > 0} onOpenChange={(open) => {
        if (!open) setPendingRestore([])
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {pendingRestore.length} {pendingRestore.length === 1 ? "project" : "projects"}?</AlertDialogTitle>
            <AlertDialogDescription>Restored projects will appear on the dashboard again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRestore()}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
