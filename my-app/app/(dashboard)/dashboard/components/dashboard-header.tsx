"use client"

import * as React from "react"
import { ChevronDown, Plus, Search } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export type DashboardBoardFilter = "none" | "assignee" | "subtask"

type DashboardHeaderProps = {
  people: Person[]
  onCreate?: () => void
  onCreateSprint?: () => void
  onManageSprints?: () => void
  searchValue: string
  onSearchChange: (value: string) => void
  filterValue: DashboardBoardFilter
  onFilterChange: (value: DashboardBoardFilter) => void
}

export function DashboardHeader({
  people,
  onCreate,
  onCreateSprint,
  onManageSprints,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
}: DashboardHeaderProps) {
  const [projectName, setProjectName] = React.useState("No project selected")
  const visiblePeople = people.slice(0, 3)
  const hiddenCount = Math.max(people.length - visiblePeople.length, 0)

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
      <div className="text-[11px] text-muted-foreground">
        Project / <span className="text-foreground">{projectName}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">Board</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs dark:border-[#343434] dark:bg-[#262626]">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-8 rounded-none border-0 px-3 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-[#303030]"
                onClick={onCreateSprint}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Sprint
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-8 rounded-none border-0 border-l border-slate-200 px-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-[#343434] dark:text-slate-300 dark:hover:bg-[#303030] dark:hover:text-slate-100"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                >
                  <DropdownMenuItem onSelect={onCreateSprint}>
                    <Plus className="h-4 w-4" />
                    Create Sprint
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onManageSprints}>
                    Manage Sprints
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-8 text-xs"
              placeholder="Search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <Select
            value={filterValue}
            onValueChange={(value) => onFilterChange(value as DashboardBoardFilter)}
          >
            <SelectTrigger size="sm" className="h-8 min-w-[92px] px-2 text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
              <SelectItem value="subtask">Subtask</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center">
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
  )
}
