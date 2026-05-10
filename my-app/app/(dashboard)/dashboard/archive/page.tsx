"use client"

import * as React from "react"
import {
  ArchiveRestore,
  Ellipsis,
  FileText,
  Filter,
  FolderKanban,
  GitFork,
  Link2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"

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
import type { BacklogApiItem, TodoItem } from "../types"
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
type ArchiveTableRow =
  | { type: "item"; item: TodoItem; depth: number }
  | { type: "attachment"; item: ArchivedAttachment; depth: number }

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
  const [pendingRestoreRow, setPendingRestoreRow] = React.useState<ArchiveTableRow | null>(null)
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

  const buildArchiveRows = React.useCallback((items: TodoItem[], attachments: ArchivedAttachment[]) => {
    const archivedItemIds = new Set(todos.map((item) => item.id))
    const topLevelItems = items
      .filter((item) => !item.parentId || !archivedItemIds.has(item.parentId))
      .map((item): ArchiveTableRow => ({ type: "item", item, depth: 0 }))
    const looseAttachments = attachments
      .filter((item) => !archivedItemIds.has(item.backlogItemId))
      .map((item): ArchiveTableRow => ({ type: "attachment", item, depth: 0 }))

    return [...topLevelItems, ...looseAttachments]
  }, [todos])
  const archiveRows = React.useMemo(
    () => buildArchiveRows(visibleItems, visibleAttachmentItems),
    [buildArchiveRows, visibleAttachmentItems, visibleItems]
  )
  const totalArchiveRows = React.useMemo(
    () => buildArchiveRows(todos, archivedAttachments),
    [archivedAttachments, buildArchiveRows, todos]
  )

  const allRows = archiveRows.map((row) => row.item.id)
  const allVisibleSelected =
    allRows.length > 0 &&
    allRows.every((id) => selectedIds.includes(id))
  const someVisibleSelected =
    allRows.some((id) => selectedIds.includes(id)) && !allVisibleSelected
  const getArchiveRowTypeLabel = React.useCallback((row: ArchiveTableRow) => {
    if (row.type === "attachment") {
      return row.item.attachmentType === "link" ? "Weblink" : "Attachment"
    }

    return row.item.parentId ? "Subtask" : "Task"
  }, [])
  const getArchiveRowIcon = React.useCallback((row: ArchiveTableRow) => {
    if (row.type === "attachment") {
      return row.item.attachmentType === "link" ? Link2 : FileText
    }

    return row.item.parentId ? GitFork : FolderKanban
  }, [])
  const renderArchiveKey = React.useCallback((row: ArchiveTableRow, displayId: string) => {
    const RowIcon = getArchiveRowIcon(row)

    return (
      <span className="inline-flex items-center gap-1.5">
        <RowIcon className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
        <span>{displayId}</span>
      </span>
    )
  }, [getArchiveRowIcon])

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

  const handleConfirmRestore = React.useCallback(async () => {
    if (!pendingRestoreRow) {
      return
    }

    const row = pendingRestoreRow
    setPendingRestoreRow(null)

    if (row.type === "item") {
      await handleRestore(row.item.id)
      return
    }

    await handleRestoreAttachment(row.item)
  }, [handleRestore, handleRestoreAttachment, pendingRestoreRow])

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
                <th className="w-9 px-2.5 py-2">
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
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Key</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Date archived</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Created by</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Archived by</th>
                <th className="w-11 px-2 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archiveRows.map((row) => {
                if (row.type === "item") {
                  const item = row.item
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
                      <td className="px-2.5 py-2 align-middle">
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
                      <td
                        className="px-2 py-2 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100"
                        style={{ paddingLeft: `${0.75 + row.depth * 1.25}rem` }}
                      >
                        {renderArchiveKey(row, item.displayId)}
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-[#303030] dark:text-slate-300">
                          {getArchiveRowTypeLabel(row)}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-2 py-2 align-middle text-sm text-slate-700 dark:text-slate-200">
                        <div className="flex min-w-0 items-center gap-2">
                          {row.depth > 0 ? (
                            <span className="h-px w-4 bg-slate-300 dark:bg-[#4a4a4a]" aria-hidden="true" />
                          ) : null}
                          <span className="truncate whitespace-nowrap" title={item.title}>
                            {item.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="inline-flex rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 dark:border-[#4a4a4a] dark:text-slate-200">
                          {item.archivedAt ? formatDeadline(item.archivedAt) : "-"}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{getInitials(createdByName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-700 dark:text-slate-200">
                            {createdByName}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{getInitials(archivedByName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-slate-700 dark:text-slate-200">
                            {archivedByName}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-100"
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
                              onSelect={() => setPendingRestoreRow(row)}
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
                }

                const item = row.item
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
                    <td className="px-2.5 py-2 align-middle">
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
                    <td
                      className="px-2 py-2 align-middle text-sm font-semibold text-slate-900 dark:text-slate-100"
                      style={{ paddingLeft: `${0.75 + row.depth * 1.25}rem` }}
                    >
                      {renderArchiveKey(row, displayId)}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-[#303030] dark:text-slate-300">
                        {getArchiveRowTypeLabel(row)}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-2 py-2 align-middle text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex min-w-0 items-center gap-2">
                        {row.depth > 0 ? (
                          <span className="h-px w-4 bg-slate-300 dark:bg-[#4a4a4a]" aria-hidden="true" />
                        ) : null}
                        <span className="truncate whitespace-nowrap" title={resourceName}>
                          {resourceName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <span className="inline-flex rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 dark:border-[#4a4a4a] dark:text-slate-200">
                        {item.archivedAt ? formatDeadline(item.archivedAt) : "-"}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(createdByName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {createdByName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(archivedByName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {archivedByName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-100"
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
                            onSelect={() => setPendingRestoreRow(row)}
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
              {archiveRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No archived items match your search or filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-2 text-center text-sm text-slate-500 dark:border-[#343434] dark:text-slate-400">
          {archiveRows.length} of {totalArchiveRows.length}
        </div>
      </div>

      <AlertDialog
        open={pendingRestoreRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRestoreRow(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-sm border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[#3a3a3a] dark:bg-[#2f3033] dark:text-slate-100">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-semibold leading-tight text-slate-950 dark:text-slate-100">
              <ArchiveRestore className="h-5 w-5 shrink-0 text-blue-600 dark:text-amber-400" />
              You&apos;re about to restore this work item
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-200">
              Once restored, you&apos;ll be able to view and edit the work item
              {pendingRestoreRow?.type === "item" && !pendingRestoreRow.item.parentId
                ? ", including subtasks,"
                : ""}
              {" "}from this space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-transparent bg-transparent text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-transparent dark:hover:text-white"
              onClick={() => setPendingRestoreRow(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 text-white hover:bg-blue-500 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
              onClick={() => void handleConfirmRestore()}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
