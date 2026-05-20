"use client"

import * as React from "react"
import { Filter, Search } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  getDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"
import { getInitials } from "../utils"

type Person = {
  name: string
  src: string
}

function normalizePersonName(name: string) {
  return name
    .trim()
    .replace(/\s*\((student|faculty|adviser)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export type DashboardBoardFilter = "none" | "assignee" | "subtask"

const activeHeaderFilterItemClassName =
  "bg-[color:rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary-fixed)] data-[highlighted]:bg-[color:rgba(var(--brand-primary-rgb),0.12)] data-[highlighted]:text-[var(--brand-primary-fixed)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.22)] dark:text-[#9bc2e2] dark:data-[highlighted]:bg-[color:rgba(var(--brand-primary-rgb),0.28)] dark:data-[highlighted]:text-[#c3dbef]"

type DashboardHeaderProps = {
  people: Person[]
  breadcrumbSectionLabel?: string | null
  showFilter?: boolean
  boardTitle?: string
  showCreateButton?: boolean
  onProjectSelect?: () => void
  onBreadcrumbSectionSelect?: () => void
  onCreate?: () => void
  searchValue: string
  onSearchChange: (value: string) => void
  filterValue: DashboardBoardFilter
  onFilterChange: (value: DashboardBoardFilter) => void
}

export function DashboardHeader({
  people,
  breadcrumbSectionLabel,
  showFilter = true,
  boardTitle = "Board",
  showCreateButton = true,
  onProjectSelect,
  onBreadcrumbSectionSelect,
  onCreate,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
}: DashboardHeaderProps) {
  const [projectName, setProjectName] = React.useState("No project selected")
  const hasActiveFilters = filterValue !== "none"
  const activeFilterCount = hasActiveFilters ? 1 : 0
  const uniquePeople = React.useMemo(() => {
    const seenNames = new Set<string>()

    return people.filter((person) => {
      const normalizedName = normalizePersonName(person.name)

      if (!normalizedName || seenNames.has(normalizedName)) {
        return false
      }

      seenNames.add(normalizedName)
      return true
    })
  }, [people])
  const visiblePeople = uniquePeople.slice(0, 3)
  const hiddenCount = Math.max(uniquePeople.length - visiblePeople.length, 0)

  React.useEffect(() => {
    const syncProject = () => {
      const savedProjectId = getSelectedDashboardProjectId()
      setProjectName(getDashboardProject(savedProjectId)?.name ?? "No project selected")
    }

    syncProject()
    window.addEventListener("storage", syncProject)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProject)

    return () => {
      window.removeEventListener("storage", syncProject)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProject)
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <span>Project /</span>
        <button
          type="button"
          className="text-foreground transition hover:underline"
          onClick={onProjectSelect}
        >
          {projectName}
        </button>
        {breadcrumbSectionLabel ? (
          <>
            <span>/</span>
            <button
              type="button"
              className="text-foreground transition hover:underline"
              onClick={onBreadcrumbSectionSelect}
            >
              {breadcrumbSectionLabel}
            </button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">{boardTitle}</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            {showCreateButton ? (
              <Button
                type="button"
                size="sm"
                className="min-h-8 self-start hover:opacity-90 sm:self-auto"
                style={{
                  backgroundColor: "var(--brand-primary-fixed)",
                  color: "var(--brand-primary-fixed-foreground)",
                }}
                onClick={onCreate}
              >
                Create
              </Button>
            ) : null}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:w-[220px] sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-full pl-8 text-xs"
                placeholder="Search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>

            {showFilter ? (
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                      aria-label="Filter board items"
                      title="Filter"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filter</span>
                      {hasActiveFilters ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded bg-[color:rgba(var(--brand-primary-rgb),0.1)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-primary-fixed)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.22)] dark:text-[#9bc2e2]">
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
                        onFilterChange(filterValue === "assignee" ? "none" : "assignee")
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
                    onClick={() => onFilterChange("none")}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex shrink-0 items-center">
              {visiblePeople.map((person, index) => (
                <Avatar
                  key={person.name}
                  title={person.name}
                  className={`h-7 w-7 ring-2 ring-background ${
                    index === 0 ? "" : "-ml-2"
                  }`}
                >
                  <AvatarImage src={person.src} alt={person.name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>
              ))}

              {hiddenCount > 0 ? (
                <Avatar className="h-7 w-7 ring-2 ring-background -ml-2" title={`${hiddenCount} more members`}>
                  <AvatarFallback className="text-[10px]">+{hiddenCount}</AvatarFallback>
                </Avatar>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
