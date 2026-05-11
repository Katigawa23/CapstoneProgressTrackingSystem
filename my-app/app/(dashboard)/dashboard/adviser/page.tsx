"use client"

import * as React from "react"
import { Search, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { readClientAuthSession, subscribeToAuthChange } from "@/lib/auth-client"
import {
  findDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
  refreshDashboardProjects,
} from "@/lib/projects"
import { getInitials } from "../utils"

export default function AdviserPage() {
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState("")
  const [currentUserName, setCurrentUserName] = React.useState("")
  const [searchValue, setSearchValue] = React.useState("")

  React.useEffect(() => {
    const syncProject = () => setProjectId(getSelectedDashboardProjectId())
    const syncAuth = () => {
      const session = readClientAuthSession()?.user
      setCurrentUserId(session?.id?.trim() ?? "")
      setCurrentUserName(session?.name?.trim() ?? "")
    }

    syncProject()
    syncAuth()
    window.addEventListener("storage", syncProject)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProject)
    const unsubscribe = subscribeToAuthChange(syncAuth)
    void refreshDashboardProjects().catch(() => undefined)

    return () => {
      window.removeEventListener("storage", syncProject)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProject)
      unsubscribe()
    }
  }, [])

  const selectedProject = React.useMemo(
    () => findDashboardProject(projectId),
    [projectId]
  )
  const adviserName = React.useMemo(() => {
    if (!selectedProject) {
      return ""
    }

    const ownerName = selectedProject.ownerName?.trim()

    if (ownerName) {
      return ownerName
    }

    if (selectedProject.ownerUserId === currentUserId && currentUserName) {
      return currentUserName
    }

    return selectedProject.ownerUserId?.trim() ?? ""
  }, [currentUserId, currentUserName, selectedProject])
  const advisers = React.useMemo(
    () => (adviserName ? [adviserName] : []),
    [adviserName]
  )
  const visibleAdvisers = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return advisers
    }

    return advisers.filter((name) =>
      name.toLowerCase().includes(normalizedSearch)
    )
  }, [advisers, searchValue])

  return (
    <div className="space-y-4 px-2 py-1 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Advisers
          </h1>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search advisers"
            className="h-9 rounded-[8px] border-slate-200 bg-white pl-9 text-xs shadow-sm dark:border-[#343434] dark:bg-[#1d1d1d]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-white shadow-sm dark:border-[#2f313a] dark:bg-[#20212a]">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#2d2f38] dark:bg-[#171821]">
              <tr className="text-left">
                <th className="px-4 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                  Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d2f38]">
              {visibleAdvisers.length > 0 ? (
                visibleAdvisers.map((adviser) => (
                  <tr
                    key={adviser}
                    className="transition hover:bg-slate-50 dark:hover:bg-[#252734]"
                  >
                    <td className="px-4 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-blue-600 text-[10px] font-semibold text-white dark:bg-blue-600">
                            {getInitials(adviser) || <UserRound className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <p className="truncate text-xs font-medium text-slate-950 dark:text-slate-100">
                          {adviser}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No advisers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
