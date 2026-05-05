import { ChevronDown, Filter, Plus, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type BacklogSectionFilter =
  | "none"
  | "assignee"
  | "todo"
  | "inprogress"
  | "revision"
  | "completed"

const activeFilterItemClassName =
  "bg-blue-50 text-blue-700 data-[highlighted]:bg-blue-100 data-[highlighted]:text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 dark:data-[highlighted]:bg-blue-500/30 dark:data-[highlighted]:text-blue-100"
const activeStatusFilterItemClassName =
  "bg-slate-100 text-slate-900 data-[highlighted]:bg-slate-200 data-[highlighted]:text-slate-950 dark:bg-[#303030] dark:text-slate-100 dark:data-[highlighted]:bg-[#3a3a3a] dark:data-[highlighted]:text-white"

type BacklogToolbarProps = {
  title: string
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void
  filterValue: BacklogSectionFilter
  onFilterChange: (value: BacklogSectionFilter) => void
  showCreateTaskButton?: boolean
  onCreateTask?: () => void
  showCreateSprintButton?: boolean
  canCreateSprint?: boolean
  sprints?: Array<{
    id: string
    name: string
  }>
  onCreateSprint?: () => void
  onSprintSelect?: (sprintId: string | null) => void
}

export function BacklogToolbar({
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  showCreateTaskButton = false,
  onCreateTask,
  showCreateSprintButton = false,
  canCreateSprint = true,
  sprints = [],
  onCreateSprint,
  onSprintSelect,
}: BacklogToolbarProps) {
  const hasActiveFilters = filterValue !== "none"
  const activeFilterCount = hasActiveFilters ? 1 : 0

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-display text-xl font-semibold tracking-tight text-black dark:text-slate-100">
        {title}
      </h1>

      <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
        {showCreateTaskButton ? (
          <Button
            type="button"
            className="shrink-0 gap-2 border-0 bg-sky-600 text-white shadow-none hover:bg-sky-700 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500"
            onClick={onCreateTask}
          >
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        ) : null}

        {showCreateSprintButton ? (
          <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs dark:border-[#343434] dark:bg-[#262626]">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-8 rounded-none border-0 px-3 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-[#303030]"
              onClick={onCreateSprint}
              disabled={!canCreateSprint}
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
                  {canCreateSprint ? (
                    <DropdownMenuItem onSelect={onCreateSprint}>
                      <Plus className="h-4 w-4" />
                      Create Sprint
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Plus className="h-4 w-4" />
                      Create Sprint
                    </DropdownMenuItem>
                  )}
                  {sprints.length > 0 ? <DropdownMenuSeparator /> : null}
                  {sprints.map((sprint) => (
                    <DropdownMenuItem
                      key={sprint.id}
                      onSelect={() => onSprintSelect?.(sprint.id)}
                    >
                      <span className="truncate">{sprint.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        <div className="relative min-w-0 flex-1 sm:w-[190px] sm:flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60 dark:text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9 text-black placeholder:text-black/50 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-black/20 bg-white px-3 text-xs text-black shadow-xs transition hover:bg-slate-50 dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:hover:bg-[#303030]"
                aria-label="Filter backlog items"
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
                  filterValue === "assignee" ? activeFilterItemClassName : undefined
                }
                onSelect={() =>
                  onFilterChange(filterValue === "assignee" ? "none" : "assignee")
                }
              >
                Assign to me
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                  <DropdownMenuItem
                    className={
                      filterValue === "none" ? activeStatusFilterItemClassName : undefined
                    }
                    onSelect={() => onFilterChange("none")}
                  >
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2",
                      filterValue === "todo" ? activeStatusFilterItemClassName : undefined
                    )}
                    onSelect={() => onFilterChange("todo")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    To do
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2",
                      filterValue === "inprogress"
                        ? activeStatusFilterItemClassName
                        : undefined
                    )}
                    onSelect={() => onFilterChange("inprogress")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                    In progress
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2",
                      filterValue === "revision"
                        ? activeStatusFilterItemClassName
                        : undefined
                    )}
                    onSelect={() => onFilterChange("revision")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    Revision
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2",
                      filterValue === "completed"
                        ? activeStatusFilterItemClassName
                        : undefined
                    )}
                    onSelect={() => onFilterChange("completed")}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    Completed
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters ? (
            <button
              type="button"
              className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-[#9fadbc] dark:hover:text-[#dee4ea]"
              onClick={() => onFilterChange("none")}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
