import { ChevronDown, Plus, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type BacklogSectionFilter = "none" | "task" | "subtask" | "completed"

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

        <Select
          value={filterValue}
          onValueChange={(value) => onFilterChange(value as BacklogSectionFilter)}
        >
          <SelectTrigger className="w-[120px] border-black/20 text-black dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="subtask">Subtask</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
