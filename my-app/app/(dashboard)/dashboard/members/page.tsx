"use client"

import * as React from "react"
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
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
import { Input } from "@/components/ui/input"
import { readClientAuthSession, subscribeToAuthChange } from "@/lib/auth-client"
import { markDashboardProjectPageSeenInSession } from "@/lib/dashboard-first-open"
import {
  findDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  refreshDashboardProjects,
} from "@/lib/projects"
import { getInitials } from "../utils"

type ProjectMember = {
  userId: string
  name: string
  email: string
  role: "student" | "faculty" | "admin"
  projectRole: string
  canCreateSprint: boolean
  isOwner: boolean
}

type RegisteredUserOption = {
  id: string
  email: string
  name: string
  role: string
}

export default function MembersPage() {
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState("")
  const [currentUserRole, setCurrentUserRole] = React.useState("")
  const [members, setMembers] = React.useState<ProjectMember[]>([])
  const [searchValue, setSearchValue] = React.useState("")
  const [addSearchValue, setAddSearchValue] = React.useState("")
  const [memberOptions, setMemberOptions] = React.useState<RegisteredUserOption[]>([])
  const [isMemberOptionsOpen, setIsMemberOptionsOpen] = React.useState(false)
  const [isLoadingMemberOptions, setIsLoadingMemberOptions] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [savingMemberIds, setSavingMemberIds] = React.useState<string[]>([])
  const [roleDrafts, setRoleDrafts] = React.useState<Record<string, string>>({})
  const [editingRoleMemberId, setEditingRoleMemberId] = React.useState<string | null>(null)
  const [pendingRemoveMember, setPendingRemoveMember] =
    React.useState<ProjectMember | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const latestMemberRequestId = React.useRef(0)

  React.useEffect(() => {
    const syncProject = () => setProjectId(getSelectedDashboardProjectId())
    const syncAuth = () => {
      const session = readClientAuthSession()?.user
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
    if (projectId) {
      markDashboardProjectPageSeenInSession("members", projectId)
    }
  }, [projectId])

  const selectedProject = React.useMemo(
    () => findDashboardProject(projectId),
    [projectId]
  )
  const canManageMembers =
    currentUserRole === "faculty" || currentUserRole === "admin"

  const loadMembers = React.useCallback(async () => {
    if (!projectId) {
      setMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load members")
      }

      const data = (await response.json()) as { members: ProjectMember[] }
      setMembers(data.members)
      setRoleDrafts(
        Object.fromEntries(
          data.members.map((member) => [member.userId, member.projectRole])
        )
      )
    } catch (error) {
      console.error(error)
      setMembers([])
      setActionError("Failed to load project members.")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const visibleMembers = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return members
    }

    return members.filter((member) =>
      [
        member.name,
        member.email,
        member.projectRole,
      ].some((value) => value.toLowerCase().includes(normalizedSearch))
    )
  }, [members, searchValue])
  const addableMemberOptions = React.useMemo(() => {
    const existingUserIds = new Set(members.map((member) => member.userId))

    return memberOptions.filter(
      (member) =>
        member.role !== "faculty" &&
        member.role !== "admin" &&
        !existingUserIds.has(member.id)
    )
  }, [memberOptions, members])

  React.useEffect(() => {
    if (!canManageMembers || !isMemberOptionsOpen) {
      setMemberOptions([])
      return
    }

    const controller = new AbortController()
    const requestId = latestMemberRequestId.current + 1
    latestMemberRequestId.current = requestId
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingMemberOptions(true)
        const response = await fetch(
          `/api/registered-users?q=${encodeURIComponent(addSearchValue.trim())}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error("Failed to load registered users")
        }

        const data = (await response.json()) as { users?: RegisteredUserOption[] }

        if (latestMemberRequestId.current === requestId) {
          setMemberOptions(Array.isArray(data.users) ? data.users : [])
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load registered users", error)
          if (latestMemberRequestId.current === requestId) {
            setMemberOptions([])
          }
        }
      } finally {
        if (latestMemberRequestId.current === requestId) {
          setIsLoadingMemberOptions(false)
        }
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [addSearchValue, canManageMembers, isMemberOptionsOpen])

  const updateMember = React.useCallback(
    async (
      member: ProjectMember,
      updates: Partial<Pick<ProjectMember, "projectRole">>
    ) => {
      if (
        !projectId ||
        member.isOwner ||
        !currentUserId
      ) {
        return
      }

      const nextProjectRole = updates.projectRole ?? member.projectRole

      setSavingMemberIds((current) => [...new Set([...current, member.userId])])
      setActionError(null)

      try {
        const response = await fetch(`/api/projects/${projectId}/members`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: member.userId,
            projectRole: nextProjectRole,
            canCreateSprint: false,
          }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          throw new Error(data?.error || "Failed to update member")
        }

        const data = (await response.json()) as { member: ProjectMember }
        setMembers((current) =>
          current.map((currentMember) =>
            currentMember.userId === data.member.userId
              ? data.member
              : currentMember
          )
        )
        setRoleDrafts((current) => ({
          ...current,
          [data.member.userId]: data.member.projectRole,
        }))
        await refreshDashboardProjects().catch(() => undefined)
      } catch (error) {
        console.error(error)
        setActionError(
          error instanceof Error ? error.message : "Failed to update member."
        )
      } finally {
        setSavingMemberIds((current) =>
          current.filter((memberId) => memberId !== member.userId)
        )
      }
    },
    [canManageMembers, currentUserId, projectId]
  )

  const addMember = React.useCallback(
    async (member: RegisteredUserOption) => {
      if (!projectId || !canManageMembers) {
        return
      }

      setSavingMemberIds((current) => [...new Set([...current, member.id])])
      setActionError(null)

      try {
        const response = await fetch(`/api/projects/${projectId}/members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: member.id }),
        })

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          throw new Error(data?.error || "Failed to add member")
        }

        const data = (await response.json()) as { member: ProjectMember }
        setMembers((current) =>
          current.some((currentMember) => currentMember.userId === data.member.userId)
            ? current
            : [...current, data.member]
        )
        setRoleDrafts((current) => ({
          ...current,
          [data.member.userId]: data.member.projectRole,
        }))
        setAddSearchValue("")
        setIsMemberOptionsOpen(false)
        await refreshDashboardProjects().catch(() => undefined)
      } catch (error) {
        console.error(error)
        setActionError(error instanceof Error ? error.message : "Failed to add member.")
      } finally {
        setSavingMemberIds((current) =>
          current.filter((memberId) => memberId !== member.id)
        )
      }
    },
    [canManageMembers, projectId]
  )

  const removeMember = React.useCallback(
    async (member: ProjectMember) => {
      if (!projectId || !canManageMembers || member.isOwner) {
        return
      }

      setSavingMemberIds((current) => [...new Set([...current, member.userId])])
      setActionError(null)

      try {
        const response = await fetch(
          `/api/projects/${projectId}/members?userId=${encodeURIComponent(member.userId)}`,
          {
            method: "DELETE",
          }
        )

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          throw new Error(data?.error || "Failed to remove member")
        }

        setMembers((current) =>
          current.filter((currentMember) => currentMember.userId !== member.userId)
        )
        setRoleDrafts((current) => {
          const next = { ...current }
          delete next[member.userId]
          return next
        })
        await refreshDashboardProjects().catch(() => undefined)
      } catch (error) {
        console.error(error)
        setActionError(
          error instanceof Error ? error.message : "Failed to remove member."
        )
      } finally {
        setSavingMemberIds((current) =>
          current.filter((memberId) => memberId !== member.userId)
        )
      }
    },
    [canManageMembers, projectId]
  )

  return (
    <div className="space-y-4 px-2 py-1 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Members
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {selectedProject
              ? `View members and manage project access for ${selectedProject.name}.`
              : "Select a project to view its members."}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search"
            className="h-9 rounded-[8px] border-slate-200 bg-white pl-9 text-xs shadow-sm dark:border-[#343434] dark:bg-[#1d1d1d]"
          />
        </div>
      </div>

      {actionError ? (
        <div className="rounded-[2px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      ) : null}

      {canManageMembers ? (
        <div className="relative max-w-sm">
          <div className="relative">
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={addSearchValue}
              onChange={(event) => {
                setAddSearchValue(event.target.value)
                setIsMemberOptionsOpen(true)
              }}
              onFocus={() => setIsMemberOptionsOpen(true)}
              placeholder="Add student member"
              className="h-8 rounded-[6px] border-slate-200 bg-white pl-9 text-xs shadow-sm dark:border-[#343434] dark:bg-[#1d1d1d]"
            />
          </div>

          {isMemberOptionsOpen ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[6px] border border-slate-200 bg-white p-1 shadow-lg dark:border-[#343434] dark:bg-[#1b1b1b]">
              {isLoadingMemberOptions ? (
                <div className="flex items-center justify-center gap-2 px-3 py-5 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading students...
                </div>
              ) : addableMemberOptions.length > 0 ? (
                <div className="max-h-56 overflow-y-auto">
                  {addableMemberOptions.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-[5px] px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-[#252734]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void addMember(member)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(member.name) || <UserRound className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {member.name}
                        </span>
                        <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                          {member.email}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  No student members found.
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-white shadow-sm dark:border-[#2f313a] dark:bg-[#20212a]">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#2d2f38] dark:bg-[#171821]">
              <tr className="text-left">
                <th className="w-[48%] px-4 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                  Name
                </th>
                <th className="w-[24%] px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                  Role
                </th>
                <th className="w-[28%] px-3 py-2 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d2f38]">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading members...
                    </span>
                  </td>
                </tr>
              ) : visibleMembers.length > 0 ? (
                visibleMembers.map((member) => {
                  const isSaving = savingMemberIds.includes(member.userId)
                  const canEditMember = canManageMembers && !member.isOwner && !isSaving
                  const canEditRole = !member.isOwner && !isSaving
                  const roleDraft = roleDrafts[member.userId] ?? member.projectRole
                  const isEditingRole = editingRoleMemberId === member.userId
                  const displayedProjectRole = member.projectRole.trim() || "No role set"

                  return (
                    <tr
                      key={member.userId}
                      className="transition hover:bg-slate-50 dark:hover:bg-[#252734]"
                    >
                      <td className="px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-emerald-500 text-[10px] font-semibold text-white dark:bg-emerald-500">
                              {getInitials(member.name) || <UserRound className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-xs font-medium text-slate-950 dark:text-slate-100">
                                {member.name}
                              </p>
                            </div>
                            {member.email ? (
                              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                {member.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isEditingRole ? (
                          <div className="flex max-w-48 items-center gap-1.5">
                            <Input
                              value={roleDraft}
                              disabled={!canEditRole}
                              maxLength={40}
                              placeholder="e.g. Developer"
                              autoFocus
                              className="h-6.5 rounded-[5px] border-slate-200 bg-white text-[11px] shadow-none disabled:opacity-70 dark:border-[#3a3d48] dark:bg-[#181922]"
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.userId]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  const nextRole = roleDraft.trim()

                                  if (nextRole !== member.projectRole) {
                                    void updateMember(member, { projectRole: nextRole })
                                  }
                                  setEditingRoleMemberId(null)
                                }

                                if (event.key === "Escape") {
                                  setRoleDrafts((current) => ({
                                    ...current,
                                    [member.userId]: member.projectRole,
                                  }))
                                  setEditingRoleMemberId(null)
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[5px] border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3a3d48] dark:text-slate-300 dark:hover:bg-[#252734] dark:hover:text-white"
                              disabled={!canEditRole}
                              aria-label={`Save role for ${member.name}`}
                              title="Save role"
                              onClick={() => {
                                const nextRole = roleDraft.trim()

                                if (nextRole !== member.projectRole) {
                                  void updateMember(member, { projectRole: nextRole })
                                }
                                setEditingRoleMemberId(null)
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="grid max-w-48 grid-cols-[minmax(0,1fr)_22px] items-center gap-1.5">
                            <span
                              className={`truncate text-xs ${
                                member.projectRole.trim()
                                  ? "text-slate-700 dark:text-slate-200"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                              title={displayedProjectRole}
                            >
                              {displayedProjectRole}
                            </span>
                            {canEditRole ? (
                              <button
                                type="button"
                                className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-[5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-[#30323d] dark:hover:text-white"
                                aria-label={`Edit role for ${member.name}`}
                                title="Edit role"
                                onClick={() => {
                                  setRoleDrafts((current) => ({
                                    ...current,
                                    [member.userId]: member.projectRole,
                                  }))
                                  setEditingRoleMemberId(member.userId)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          ) : null}
                          {canManageMembers ? (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                              disabled={!canEditMember}
                              onClick={() => setPendingRemoveMember(member)}
                              aria-label={`Remove ${member.name}`}
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog
        open={pendingRemoveMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoveMember(null)
          }
        }}
      >
        <AlertDialogContent className="border-slate-200 bg-white text-slate-950 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
              This member will be removed from the project and will no longer be
              able to access this project workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (pendingRemoveMember) {
                  void removeMember(pendingRemoveMember)
                }
                setPendingRemoveMember(null)
              }}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
