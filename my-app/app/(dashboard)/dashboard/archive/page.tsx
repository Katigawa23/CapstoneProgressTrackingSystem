"use client"

import * as React from "react"
import { Ellipsis, Filter, RotateCcw, Search, Trash2 } from "lucide-react"

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
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"
import { readClientAuthSession, subscribeToAuthChange } from "@/lib/auth-client"
import type { BacklogApiItem } from "../types"
import {
  buildSubtaskDisplayId,
  buildTaskDisplayId,
  mapBacklogItemsToTodos,
  getInitials,
  formatDeadline,
} from "../utils"

type ArchiveFilter = "none" | "assignee"

type ArchiveItem = BacklogApiItem
type ArchivedAttachment = {
  id: string
  backlogItemId: string
  backlogItemParentId: string | null
  backlogItemSequenceNumber: number
  parentSequenceNumber: number | null
  attachmentType: "file" | "link"
  uploadedByUserId: string | null
  archivedByUserId: string | null
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  label: string
  uploadedAt: string
  archivedAt: string | null
}

const activeHeaderFilterItemClassName =
  "bg-blue-50 text-blue-700 data-[highlighted]:bg-blue-100 data-[highlighted]:text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 dark:data-[highlighted]:bg-blue-500/30 dark:data-[highlighted]:text-blue-100"

export default function ArchivePage() {
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValue, setFilterValue] = React.useState<ArchiveFilter>("none")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [archiveItems, setArchiveItems] = React.useState<ArchiveItem[]>([])
  const [archivedAttachments, setArchivedAttachments] = React.useState<ArchivedAttachment[]>([])
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = React.useState("")
  const [currentUserId, setCurrentUserId] = React.useState("")
  const [currentUserRole, setCurrentUserRole] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)
  const hasActiveFilters = filterValue !== "none"
  const activeFilterCount = hasActiveFilters ? 1 : 0

  const loadArchiveItems = React.useCallback(async (nextProjectId: string | null) => {
    if (!nextProjectId) {
      setArchiveItems([])
      setArchivedAttachments([])
      return
    }

    const response = await fetch(
      `/api/archive?projectId=${nextProjectId}`,
      {
        cache: "no-store",
      }
    )

    if (!response.ok) {
      throw new Error("Failed to load archived items")
    }

    const data = (await response.json()) as { items: ArchiveItem[]; attachments: ArchivedAttachment[] }
    setArchiveItems(data.items)
    setArchivedAttachments(data.attachments)
  }, [])

  React.useEffect(() => {
    const syncProject = () => {
      setProjectId(getSelectedDashboardProjectId())
    }

    const syncAuth = () => {
      const session = readClientAuthSession()?.user
      setCurrentUserName(session?.name?.trim() ?? "")
      setCurrentUserId(session?.id?.trim() ?? "")
      setCurrentUserRole(session?.role?.trim() ?? "")
    }

    syncProject()
    syncAuth()
    window.addEventListener("storage", syncProject)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProject)
    const unsubscribe = subscribeToAuthChange(syncAuth)

    return () => {
      window.removeEventListener("storage", syncProject)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProject)
      unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    void loadArchiveItems(projectId).catch((error) => {
      console.error(error)
      setArchiveItems([])
    })
  }, [loadArchiveItems, projectId])

  const selectedProject = React.useMemo(
    () => findDashboardProject(projectId),
    [projectId]
  )
  const projectCode = React.useMemo(
    () => getDashboardProjectCode(selectedProject),
    [selectedProject]
  )
  const todos = React.useMemo(
    () => mapBacklogItemsToTodos(archiveItems, projectCode),
    [archiveItems, projectCode]
  )
  const namesById = React.useMemo(() => {
    const next: Record<string, string> = {}
    const memberIds = selectedProject?.memberUserIds ?? []
    const memberNames = selectedProject?.members ?? []

    memberIds.forEach((id, index) => {
      if (id.trim() && memberNames[index]?.trim()) {
        next[id.trim()] = memberNames[index].trim()
      }
    })

    if (currentUserId && currentUserName) {
      next[currentUserId] = currentUserName
    }

    return next
  }, [currentUserId, currentUserName, selectedProject])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return todos.filter((item) => {
      const createdByName = namesById[item.createdByUserId ?? ""] ?? item.createdByUserId ?? "Unknown user"
      const archivedByName = namesById[item.archivedByUserId ?? ""] ?? item.archivedByUserId ?? "Unknown user"
      const matchesSearch =
        !normalizedSearch ||
        item.displayId.toLowerCase().includes(normalizedSearch) ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        createdByName.toLowerCase().includes(normalizedSearch) ||
        archivedByName.toLowerCase().includes(normalizedSearch)

      const matchesFilter =
        filterValue !== "assignee" || archivedByName === currentUserName

      return matchesSearch && matchesFilter
    })
  }, [currentUserName, filterValue, namesById, searchValue, todos])

  const visibleAttachmentItems = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return archivedAttachments.filter((item) => {
      const createdByName = namesById[item.uploadedByUserId ?? ""] ?? item.uploadedByUserId ?? "Unknown user"
      const archivedByName = namesById[item.archivedByUserId ?? ""] ?? item.archivedByUserId ?? "Unknown user"
      const displayId =
        item.backlogItemParentId && item.parentSequenceNumber
          ? buildSubtaskDisplayId(
              buildTaskDisplayId(projectCode, item.parentSequenceNumber),
              item.backlogItemSequenceNumber
            )
          : buildTaskDisplayId(projectCode, item.backlogItemSequenceNumber)
      const name = item.attachmentType === "file" ? item.fileName : item.label || item.fileUrl

      const matchesSearch =
        !normalizedSearch ||
        displayId.toLowerCase().includes(normalizedSearch) ||
        name.toLowerCase().includes(normalizedSearch) ||
        createdByName.toLowerCase().includes(normalizedSearch) ||
        archivedByName.toLowerCase().includes(normalizedSearch)

      const matchesFilter =
        filterValue !== "assignee" || archivedByName === currentUserName

      return matchesSearch && matchesFilter
    })
  }, [archivedAttachments, currentUserName, filterValue, namesById, projectCode, searchValue])

  const allRows = [...visibleItems.map((item) => item.id), ...visibleAttachmentItems.map((item) => item.id)]
  const allVisibleSelected =
    allRows.length > 0 &&
    allRows.every((id) => selectedIds.includes(id))
  const someVisibleSelected =
    allRows.some((id) => selectedIds.includes(id)) && !allVisibleSelected

  const readErrorMessage = React.useCallback(async (response: Response, fallbackMessage: string) => {
    try {
      const data = (await response.json()) as { error?: string; details?: string }
      return data.details || data.error || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }, [])

  const handleRestore = React.useCallback(async (itemId: string) => {
    setActionError(null)
    const response = await fetch(`/api/backlog-items/${itemId}/restore`, {
      method: "POST",
    })

    if (!response.ok) {
      setActionError(await readErrorMessage(response, "Failed to restore archived item"))
      return
    }

    await loadArchiveItems(projectId)
  }, [loadArchiveItems, projectId, readErrorMessage])

  const handleDelete = React.useCallback(async (itemId: string) => {
    setActionError(null)
    const response = await fetch(`/api/backlog-items/${itemId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      setActionError(await readErrorMessage(response, "Failed to delete archived item"))
      return
    }

    await loadArchiveItems(projectId)
  }, [loadArchiveItems, projectId, readErrorMessage])

  const handleRestoreAttachment = React.useCallback(async (item: ArchivedAttachment) => {
    setActionError(null)
    const route =
      item.attachmentType === "file"
        ? `/api/backlog-items/${item.backlogItemId}/submissions/restore?submissionId=${encodeURIComponent(item.id)}`
        : `/api/backlog-items/${item.backlogItemId}/links/restore?linkId=${encodeURIComponent(item.id)}`

    const response = await fetch(route, { method: "POST" })

    if (!response.ok) {
      setActionError(await readErrorMessage(response, "Failed to restore archived resource"))
      return
    }

    await loadArchiveItems(projectId)
  }, [loadArchiveItems, projectId, readErrorMessage])

  const handleDeleteAttachment = React.useCallback(async (item: ArchivedAttachment) => {
    setActionError(null)
    const route =
      item.attachmentType === "file"
        ? `/api/backlog-items/${item.backlogItemId}/submissions?submissionId=${encodeURIComponent(item.id)}`
        : `/api/backlog-items/${item.backlogItemId}/links?linkId=${encodeURIComponent(item.id)}`

    const response = await fetch(route, { method: "DELETE" })

    if (!response.ok) {
      setActionError(await readErrorMessage(response, "Failed to delete archived resource"))
      return
    }

    await loadArchiveItems(projectId)
  }, [loadArchiveItems, projectId, readErrorMessage])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">Achived</h1>

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

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                  aria-label="Filter archive items"
                  title="Filter"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                  {hasActiveFilters ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
              >
                <DropdownMenuItem
                  className={
                    filterValue === "assignee"
                      ? activeHeaderFilterItemClassName
                      : undefined
                  }
                  onSelect={() =>
                    setFilterValue(filterValue === "assignee" ? "none" : "assignee")
                  }
                >
                  Assign to me
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs text-slate-500 transition hover:text-slate-900 dark:text-[#9fadbc] dark:hover:text-[#dee4ea]"
                onClick={() => setFilterValue("none")}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="rounded-[2px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-xs dark:border-[#343434] dark:bg-[#1f1f1f]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#343434] dark:bg-[#202020]">
              <tr className="text-left">
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(allRows)
                        return
                      }
                      setSelectedIds([])
                    }}
                    aria-label="Select all archived items"
                  />
                </th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Key</th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Date archived</th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Created by</th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Archived by</th>
                <th className="w-14 px-3 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => {
                  const createdByName = namesById[item.createdByUserId ?? ""] ?? item.createdByUserId ?? "Unknown user"
                  const archivedByName = namesById[item.archivedByUserId ?? ""] ?? item.archivedByUserId ?? "Unknown user"
                  const isSelected = selectedIds.includes(item.id)
                  const canManageTask =
                    !item.parentId ||
                    ["faculty", "admin"].includes(currentUserRole) ||
                    item.createdByUserId === currentUserId ||
                    item.archivedByUserId === currentUserId

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-[#343434] dark:hover:bg-[#242424]"
                    >
                      <td className="px-4 py-3 align-middle">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setSelectedIds((current) =>
                              checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id)
                            )
                          }}
                          aria-label={`Select ${item.displayId}`}
                        />
                      </td>
                      <td className="px-3 py-3 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.displayId}
                      </td>
                      <td className="px-3 py-3 align-middle text-sm text-slate-700 dark:text-slate-200">
                        {item.title}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="inline-flex rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-[#4a4a4a] dark:text-slate-200">
                          {item.archivedAt ? formatDeadline(item.archivedAt) : "-"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{getInitials(createdByName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-700 dark:text-slate-200">
                            {createdByName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{getInitials(archivedByName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-700 dark:text-slate-200">
                            {archivedByName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                              aria-label={`Open actions for ${item.displayId}`}
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
                              disabled={!canManageTask}
                              onSelect={() => void handleRestore(item.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canManageTask}
                              className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                              onSelect={() => void handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              ) : null}
              {visibleAttachmentItems.map((item) => {
                const createdByName = namesById[item.uploadedByUserId ?? ""] ?? item.uploadedByUserId ?? "Unknown user"
                const archivedByName = namesById[item.archivedByUserId ?? ""] ?? item.archivedByUserId ?? "Unknown user"
                const isSelected = selectedIds.includes(item.id)
                const canManageAttachment =
                  ["faculty", "admin"].includes(currentUserRole) ||
                  item.uploadedByUserId === currentUserId
                const displayId =
                  item.backlogItemParentId && item.parentSequenceNumber
                    ? buildSubtaskDisplayId(
                        buildTaskDisplayId(projectCode, item.parentSequenceNumber),
                        item.backlogItemSequenceNumber
                      )
                    : buildTaskDisplayId(projectCode, item.backlogItemSequenceNumber)
                const resourceName =
                  item.attachmentType === "file" ? item.fileName : item.label || item.fileUrl

                return (
                  <tr
                    key={item.id}
                    className="border-b border-slate-200 transition hover:bg-slate-50 dark:border-[#343434] dark:hover:bg-[#242424]"
                  >
                    <td className="px-4 py-3 align-middle">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) =>
                            checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                          )
                        }}
                        aria-label={`Select ${displayId}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {displayId}
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-slate-700 dark:text-slate-200">
                      {resourceName}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="inline-flex rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-[#4a4a4a] dark:text-slate-200">
                        {item.archivedAt ? formatDeadline(item.archivedAt) : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(createdByName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {createdByName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(archivedByName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {archivedByName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                            aria-label={`Open actions for ${displayId}`}
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
                            disabled={!canManageAttachment}
                            onSelect={() => void handleRestoreAttachment(item)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canManageAttachment}
                            className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                            onSelect={() => void handleDeleteAttachment(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
              {visibleItems.length === 0 && visibleAttachmentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No archived items match your search or filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-500 dark:border-[#343434] dark:text-slate-400">
          {visibleItems.length + visibleAttachmentItems.length} of {todos.length + archivedAttachments.length}
        </div>
      </div>
    </div>
  )
}
