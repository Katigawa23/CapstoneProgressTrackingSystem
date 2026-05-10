"use client"

import * as React from "react"
import {
  ChevronDown,
  Ellipsis,
  Filter,
  FileText,
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
import { readClientAuthSession, subscribeToAuthChange } from "@/lib/auth-client"
import {
  findDashboardProject,
  getDashboardProjectCode,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"
import type { BacklogApiItem, TodoItem } from "../types"
import {
  buildSubtaskDisplayId,
  buildTaskDisplayId,
  formatDeadline,
  getInitials,
  mapBacklogItemsToTodos,
} from "../utils"

type RecycleFilter = "none" | "deletedByMe"
type DeletedAttachment = {
  id: string
  backlogItemId: string
  backlogItemParentId: string | null
  backlogItemSequenceNumber: number
  parentSequenceNumber: number | null
  attachmentType: "file" | "link"
  uploadedByUserId: string | null
  deletedByUserId: string | null
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number
  label: string
  uploadedAt: string
  deletedAt: string | null
}
type RecycleRow =
  | { type: "item"; item: TodoItem; depth: number }
  | { type: "attachment"; item: DeletedAttachment; depth: number }
type RecycleGroup = {
  id: string
  label: string
  rows: RecycleRow[]
}

const activeHeaderFilterItemClassName =
  "bg-blue-50 text-blue-700 data-[highlighted]:bg-blue-100 data-[highlighted]:text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 dark:data-[highlighted]:bg-blue-500/30 dark:data-[highlighted]:text-blue-100"

function getStartOfDay(value: Date) {
  const nextDate = new Date(value)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function getDeletedGroupId(deletedAt?: string | null) {
  if (!deletedAt) {
    return "unknown"
  }

  const deletedDate = new Date(deletedAt)

  if (Number.isNaN(deletedDate.getTime())) {
    return "unknown"
  }

  const today = getStartOfDay(new Date())
  const deletedDay = getStartOfDay(deletedDate)
  const diffDays = Math.floor(
    (today.getTime() - deletedDay.getTime()) / (24 * 60 * 60 * 1000)
  )

  if (diffDays <= 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays <= 7) return "last-week"
  if (diffDays <= 31) return "last-month"
  return "older"
}

function getRecycleRowDeletedAt(row: RecycleRow) {
  return row.item.deletedAt
}

function getRecycleRowDisplayId(row: RecycleRow, projectCode: string) {
  if (row.type === "attachment") {
    return row.item.backlogItemParentId && row.item.parentSequenceNumber
      ? buildSubtaskDisplayId(
          buildTaskDisplayId(projectCode, row.item.parentSequenceNumber),
          row.item.backlogItemSequenceNumber
        )
      : buildTaskDisplayId(projectCode, row.item.backlogItemSequenceNumber)
  }

  return row.item.displayId
}

function getRecycleRowTitle(row: RecycleRow) {
  if (row.type === "attachment") {
    return row.item.attachmentType === "file"
      ? row.item.fileName
      : row.item.label || row.item.fileUrl
  }

  return row.item.title
}

function getRecycleRowTypeLabel(row: RecycleRow) {
  if (row.type === "attachment") {
    return row.item.attachmentType === "file" ? "Attachment" : "Weblink"
  }

  return row.item.parentId ? "Subtask" : "Task"
}

function getRecycleRowCreatorId(row: RecycleRow) {
  return row.type === "attachment"
    ? row.item.uploadedByUserId
    : row.item.createdByUserId
}

function getRecycleRowIcon(row: RecycleRow) {
  if (row.type === "attachment") {
    return row.item.attachmentType === "file" ? FileText : Link2
  }

  return row.item.parentId ? GitFork : FolderKanban
}

const recycleGroupLabels: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "last-week": "Last week",
  "last-month": "Last month",
  older: "Older",
  unknown: "Unknown date",
}

const recycleGroupOrder = [
  "today",
  "yesterday",
  "last-week",
  "last-month",
  "older",
  "unknown",
]

export default function RecycleBinPage() {
  const [searchValue, setSearchValue] = React.useState("")
  const [filterValue, setFilterValue] = React.useState<RecycleFilter>("none")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [deletedItems, setDeletedItems] = React.useState<BacklogApiItem[]>([])
  const [deletedAttachments, setDeletedAttachments] = React.useState<DeletedAttachment[]>([])
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = React.useState("")
  const [currentUserId, setCurrentUserId] = React.useState("")
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [pendingRestoreRow, setPendingRestoreRow] =
    React.useState<RecycleRow | null>(null)
  const [pendingDeleteRow, setPendingDeleteRow] =
    React.useState<RecycleRow | null>(null)
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<string[]>([])

  const hasActiveFilters = filterValue !== "none"
  const activeFilterCount = hasActiveFilters ? 1 : 0

  const loadRecycleItems = React.useCallback(async (nextProjectId: string | null) => {
    if (!nextProjectId) {
      setDeletedItems([])
      setDeletedAttachments([])
      return
    }

    const response = await fetch(`/api/recycle-bin?projectId=${nextProjectId}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Failed to load deleted items")
    }

    const data = (await response.json()) as {
      items: BacklogApiItem[]
      attachments: DeletedAttachment[]
    }
    setDeletedItems(data.items)
    setDeletedAttachments(data.attachments)
  }, [])

  React.useEffect(() => {
    const syncProject = () => setProjectId(getSelectedDashboardProjectId())
    const syncAuth = () => {
      const session = readClientAuthSession()?.user
      setCurrentUserName(session?.name?.trim() ?? "")
      setCurrentUserId(session?.id?.trim() ?? "")
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
    void loadRecycleItems(projectId).catch((error) => {
      console.error(error)
      setDeletedItems([])
    })
  }, [loadRecycleItems, projectId])

  const selectedProject = React.useMemo(
    () => findDashboardProject(projectId),
    [projectId]
  )
  const projectCode = React.useMemo(
    () => getDashboardProjectCode(selectedProject),
    [selectedProject]
  )
  const todos = React.useMemo(
    () => mapBacklogItemsToTodos(deletedItems, projectCode),
    [deletedItems, projectCode]
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
      const createdByName =
        namesById[item.createdByUserId ?? ""] ??
        item.createdByUserId ??
        "Unknown user"
      const deletedByName =
        namesById[item.deletedByUserId ?? ""] ??
        item.deletedByUserId ??
        "Unknown user"
      const matchesSearch =
        !normalizedSearch ||
        item.displayId.toLowerCase().includes(normalizedSearch) ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        createdByName.toLowerCase().includes(normalizedSearch) ||
        deletedByName.toLowerCase().includes(normalizedSearch)
      const matchesFilter =
        filterValue !== "deletedByMe" || deletedByName === currentUserName

      return matchesSearch && matchesFilter
    })
  }, [currentUserName, filterValue, namesById, searchValue, todos])

  const visibleAttachmentItems = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return deletedAttachments.filter((item) => {
      const createdByName =
        namesById[item.uploadedByUserId ?? ""] ??
        item.uploadedByUserId ??
        "Unknown user"
      const deletedByName =
        namesById[item.deletedByUserId ?? ""] ??
        item.deletedByUserId ??
        "Unknown user"
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
        deletedByName.toLowerCase().includes(normalizedSearch)
      const matchesFilter =
        filterValue !== "deletedByMe" || deletedByName === currentUserName

      return matchesSearch && matchesFilter
    })
  }, [currentUserName, deletedAttachments, filterValue, namesById, projectCode, searchValue])

  const buildRecycleRows = React.useCallback((items: TodoItem[], attachments: DeletedAttachment[]) => {
    const deletedIds = new Set(items.map((item) => item.id))

    const itemRows = items
      .filter((item) => !item.parentId || !deletedIds.has(item.parentId))
      .map((item): RecycleRow => ({ type: "item", item, depth: 0 }))

    const attachmentRows = attachments
      .filter((item) => !deletedIds.has(item.backlogItemId))
      .map((item): RecycleRow => ({ type: "attachment", item, depth: 0 }))

    return [...itemRows, ...attachmentRows]
  }, [])

  const recycleRows = React.useMemo(
    () => buildRecycleRows(visibleItems, visibleAttachmentItems),
    [buildRecycleRows, visibleAttachmentItems, visibleItems]
  )
  const totalRecycleRows = React.useMemo(
    () => buildRecycleRows(todos, deletedAttachments),
    [buildRecycleRows, deletedAttachments, todos]
  )

  const allRows = recycleRows.map((row) => row.item.id)
  const allSelected = allRows.length > 0 && allRows.every((id) => selectedIds.includes(id))
  const recycleGroups = React.useMemo<RecycleGroup[]>(() => {
    const rowsByGroup = new Map<string, RecycleRow[]>()

    for (const row of recycleRows) {
      const groupId = getDeletedGroupId(getRecycleRowDeletedAt(row))
      rowsByGroup.set(groupId, [...(rowsByGroup.get(groupId) ?? []), row])
    }

    return recycleGroupOrder
      .map((groupId) => ({
        id: groupId,
        label: recycleGroupLabels[groupId] ?? groupId,
        rows: rowsByGroup.get(groupId) ?? [],
      }))
      .filter((group) => group.rows.length > 0)
  }, [recycleRows])

  const toggleGroup = React.useCallback((groupId: string) => {
    setCollapsedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    )
  }, [])

  const readErrorMessage = React.useCallback(
    async (response: Response, fallback: string) => {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      return data?.error || fallback
    },
    []
  )

  const handleRestoreRow = React.useCallback(
    async (row: RecycleRow) => {
      setActionError(null)
      const response =
        row.type === "item"
          ? await fetch(`/api/backlog-items/${row.item.id}/recycle-restore`, {
              method: "POST",
            })
          : await fetch(`/api/recycle-bin/attachments/${row.item.id}/restore`, {
              method: "POST",
            })

      if (!response.ok) {
        setActionError(await readErrorMessage(response, "Failed to restore deleted item"))
        return
      }

      setSelectedIds((current) => current.filter((id) => id !== row.item.id))
      await loadRecycleItems(projectId)
    },
    [loadRecycleItems, projectId, readErrorMessage]
  )

  const handlePermanentDeleteRow = React.useCallback(
    async (row: RecycleRow) => {
      setActionError(null)
      const response =
        row.type === "item"
          ? await fetch(`/api/backlog-items/${row.item.id}/permanent-delete`, {
              method: "DELETE",
            })
          : await fetch(`/api/recycle-bin/attachments/${row.item.id}`, {
              method: "DELETE",
            })

      if (!response.ok) {
        setActionError(await readErrorMessage(response, "Failed to permanently delete item"))
        return
      }

      setSelectedIds((current) => current.filter((id) => id !== row.item.id))
      await loadRecycleItems(projectId)
    },
    [loadRecycleItems, projectId, readErrorMessage]
  )

  return (
    <div className="space-y-4 px-2 py-1 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Recycle Bin
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Items stay here for 30 days, then they are deleted permanently.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search"
              className="h-8 rounded-[8px] border-slate-200 bg-white pl-9 text-xs shadow-sm dark:border-[#343434] dark:bg-[#1d1d1d]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative inline-flex h-8 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#343434] dark:bg-[#1d1d1d] dark:text-slate-300 dark:hover:bg-[#252525]"
                aria-label="Filter recycle bin items"
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
                {hasActiveFilters ? (
                  <span className="inline-flex min-w-4 items-center justify-center rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
            >
              <DropdownMenuItem
                className={filterValue === "none" ? activeHeaderFilterItemClassName : undefined}
                onSelect={() => setFilterValue("none")}
              >
                All deleted
              </DropdownMenuItem>
              <DropdownMenuItem
                className={filterValue === "deletedByMe" ? activeHeaderFilterItemClassName : undefined}
                onSelect={() => setFilterValue("deletedByMe")}
              >
                Deleted by me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {actionError ? (
        <div className="rounded-[2px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-sm dark:border-[#343434] dark:bg-[#1b1b1b]">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#343434] dark:bg-[#202020]">
              <tr className="text-left">
                <th className="w-9 px-2.5 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? allRows : [])
                    }
                    aria-label="Select all deleted items"
                  />
                </th>
                <th className="w-24 px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Key</th>
                <th className="w-24 px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Name</th>
                <th className="w-32 px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Date deleted</th>
                <th className="w-72 px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Created by</th>
                <th className="w-72 px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Deleted by</th>
                <th className="w-16 px-2 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#343434]">
              {recycleGroups.map((group) => {
                const isCollapsed = collapsedGroupIds.includes(group.id)

                return (
                  <React.Fragment key={group.id}>
                    <tr className="bg-slate-50/80 dark:bg-[#202020]">
                      <td colSpan={8} className="px-2.5 py-2">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-700 transition hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                          onClick={() => toggleGroup(group.id)}
                          aria-expanded={!isCollapsed}
                        >
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              isCollapsed ? "-rotate-90" : "rotate-0"
                            }`}
                          />
                          <span>
                            {group.label} ({group.rows.length})
                          </span>
                        </button>
                      </td>
                    </tr>

                    {isCollapsed
                      ? null
                      : group.rows.map((row) => {
                          const item = row.item
                          const displayId = getRecycleRowDisplayId(row, projectCode)
                          const title = getRecycleRowTitle(row)
                          const typeLabel = getRecycleRowTypeLabel(row)
                          const createdByUserId = getRecycleRowCreatorId(row)
                          const createdByName =
                            namesById[createdByUserId ?? ""] ??
                            createdByUserId ??
                            "Unknown user"
                          const deletedByName =
                            namesById[item.deletedByUserId ?? ""] ??
                            item.deletedByUserId ??
                            "Unknown user"
                          const checked = selectedIds.includes(item.id)
                          const RowIcon = getRecycleRowIcon(row)

                          return (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#242424]">
                              <td className="px-2.5 py-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(nextChecked) =>
                                    setSelectedIds((current) =>
                                      nextChecked
                                        ? [...new Set([...current, item.id])]
                                        : current.filter((id) => id !== item.id)
                                    )
                                  }
                                  aria-label={`Select ${displayId}`}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-950 dark:text-slate-100">
                                  <RowIcon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                                  <span className="truncate">{displayId}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-[#303030] dark:text-slate-300">
                                  {typeLabel}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <p className="truncate text-sm text-slate-900 dark:text-slate-100" title={title}>
                                  {title}
                                </p>
                              </td>
                              <td className="px-2 py-2">
                                <span className="inline-flex rounded-[8px] border border-slate-200 px-2 py-1 text-xs text-slate-700 dark:border-[#454545] dark:text-slate-300">
                                  {item.deletedAt ? formatDeadline(item.deletedAt) : "-"}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Avatar size="sm">
                                    <AvatarFallback>{getInitials(createdByName)}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate text-xs text-slate-700 dark:text-slate-300">
                                    {createdByName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Avatar size="sm">
                                    <AvatarFallback>{getInitials(deletedByName)}</AvatarFallback>
                                  </Avatar>
                                  <span className="truncate text-xs text-slate-700 dark:text-slate-300">
                                    {deletedByName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#303030] dark:hover:text-slate-200"
                                      aria-label={`Open actions for ${title}`}
                                    >
                                      <Ellipsis className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-44 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                                  >
                                    <DropdownMenuItem onSelect={() => setPendingRestoreRow(row)}>
                                      <RotateCcw className="h-4 w-4" />
                                      Restore
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                                      onSelect={() => setPendingDeleteRow(row)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete permanently
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          )
                        })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {recycleRows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No deleted items match your search or filter.
          </div>
        ) : null}

        <div className="border-t border-slate-200 px-3 py-3 text-center text-xs text-slate-600 dark:border-[#343434] dark:text-slate-400">
          {recycleRows.length} of {totalRecycleRows.length}
        </div>
      </div>

      <AlertDialog
        open={pendingRestoreRow !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestoreRow(null)
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-100">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 shrink-0 text-blue-600 dark:text-amber-400" />
              <AlertDialogTitle>Restore this deleted item?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Once restored, this work item will return to its original board space.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-blue-600 text-white hover:bg-blue-500"
              onClick={() => {
                if (pendingRestoreRow) void handleRestoreRow(pendingRestoreRow)
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteRow(null)
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[2px] border-slate-200 bg-white text-slate-950 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-100">
          <AlertDialogHeader className="place-items-start text-left">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 shrink-0 text-red-600" />
              <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This permanently removes the selected item and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className="rounded-[2px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              className="rounded-[2px] bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                if (pendingDeleteRow) void handlePermanentDeleteRow(pendingDeleteRow)
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
