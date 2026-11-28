"use client"

import { useContext, useEffect, useState } from "react"
import { OpenProjectCreationContext } from "@/app/(dashboard)/dashboard/layout-client"
import { useRouter } from "next/navigation"
import { Archive, MoreHorizontal, Search } from "lucide-react"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getDashboardProjects,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
  type DashboardProject,
} from "@/lib/projects"

export default function CoordinatorPage() {
  const router = useRouter()
  const openProjectCreation = useContext(OpenProjectCreationContext)
  const [groups, setGroups] = useState<DashboardProject[]>([])
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [pendingArchive, setPendingArchive] = useState<DashboardProject | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState("")

  async function archiveGroup(group: DashboardProject) {
    setArchiving(true)
    setArchiveError("")
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(group.id)}/archive`, { method: "POST" })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || "Could not archive the group.")
      }
      setGroups((current) => current.filter(({ id }) => id !== group.id))
      await refreshDashboardProjects().catch(() => undefined)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Could not archive the group.")
    } finally {
      setArchiving(false)
    }
  }

  useEffect(() => {
    const syncGroups = () => setGroups(getDashboardProjects())

    syncGroups()
    void refreshDashboardProjects().then(setGroups).catch(() => undefined)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncGroups)
    window.addEventListener("storage", syncGroups)

    return () => {
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncGroups)
      window.removeEventListener("storage", syncGroups)
    }
  }, [])

  const normalizedSearch = searchValue.trim().toLowerCase()
  const filteredGroups = normalizedSearch
    ? groups.filter((group) =>
        [group.name, group.projectType, group.program, group.yearLevel].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      )
    : groups
  const visibleGroups = showAllGroups ? filteredGroups : filteredGroups.slice(0, 4)
  const recentGroups = filteredGroups.slice(4)

  function getInitials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  }

  function getGroupCode(group: DashboardProject, index: number) {
    const prefix = group.projectType.trim().toUpperCase().startsWith("CAPSTONE") ? "CP" : "GR"
    const year = new Date(group.createdAt).getFullYear() || new Date().getFullYear()
    return `${prefix}-${year}${String(index + 1).padStart(3, "0")}`
  }

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Choose a group
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {openProjectCreation ? <Button
              type="button"
              className="rounded-lg px-5"
              style={{
                backgroundColor: "var(--brand-primary-fixed)",
                color: "var(--brand-primary-fixed-foreground)",
              }}
              onClick={openProjectCreation}
            >
              Create
            </Button> : null}
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search groups"
                aria-label="Search groups"
                className="h-10 pl-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />
      </div>

      <section className="mt-6 space-y-4">
        {archiveError ? <p role="alert" className="text-sm text-destructive">{archiveError}</p> : null}
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">For you</h2>
          {filteredGroups.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllGroups((current) => !current)}
              className="text-sm font-medium text-[var(--brand-primary-fixed)] hover:text-[var(--brand-hover)] dark:text-[var(--brand-link)]"
            >
              {showAllGroups ? "Show less" : "View all groups"}
            </button>
          ) : null}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground dark:border-[var(--border)]">
            {normalizedSearch ? "No matching groups found." : "No groups yet. Click Create to add your first group."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleGroups.map((group) => (
              <Card
                key={group.id}
                className="relative flex min-h-[160px] w-full cursor-pointer flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:border-[var(--border)] dark:bg-[var(--card)]"
                onClick={() => {
                  setDashboardProject(group.id)
                  router.push("/coordinator/board")
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1.5 bg-[var(--brand-primary-fixed)]" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" onClick={(event) => event.stopPropagation()} aria-label={`More options for ${group.name}`} className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[var(--surface-hover)]">
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem disabled={archiving} onSelect={() => setPendingArchive(group)}>
                      <Archive className="size-4" />
                      Archive group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <CardHeader className="flex flex-1 flex-col px-5 pb-3 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    {getGroupCode(group, groups.indexOf(group))}
                  </p>
                  <CardTitle className="truncate font-display text-base font-semibold" title={group.name}>
                    {group.name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {group.projectType || "No group type"}
                  </p>
                  <div className="mt-auto flex items-center justify-end pt-3">
                    {[...group.advisers, ...group.members].slice(0, 4).map((person, personIndex) => (
                      <Avatar name={person} userId={personIndex < group.advisers.length ? (person === group.ownerName ? group.ownerUserId : undefined) : group.memberUserIds.length === group.members.length ? group.memberUserIds[personIndex - group.advisers.length] : undefined} key={`${group.id}-${person}-${personIndex}`} className={`size-7 border-2 border-white dark:border-[var(--card)] ${personIndex ? "-ml-2" : ""}`}>
                        <AvatarFallback className="bg-[var(--brand-primary-fixed)] text-[10px] text-white">
                          {getInitials(person)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h2 className="font-display text-lg font-semibold tracking-tight">Recent groups</h2>
        {recentGroups.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">No recent groups yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {recentGroups.map((group, index) => (
              <button
                type="button"
                key={group.id}
                onClick={() => {
                  setDashboardProject(group.id)
                  router.push("/coordinator/board")
                }}
                className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left hover:bg-slate-50 dark:hover:bg-[var(--surface-hover)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-8 rounded-md"><AvatarFallback className="rounded-md bg-[var(--brand-primary-fixed)] text-[10px] text-white">{getInitials(group.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{getGroupCode(group, index + 4)} - {group.projectType}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Created {new Date(group.createdAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={pendingArchive !== null} onOpenChange={(open) => {
        if (!open) setPendingArchive(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {pendingArchive?.name}?</AlertDialogTitle>
            <AlertDialogDescription>You can restore this group from the Archive page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingArchive) void archiveGroup(pendingArchive)
            }}>Archive group</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
