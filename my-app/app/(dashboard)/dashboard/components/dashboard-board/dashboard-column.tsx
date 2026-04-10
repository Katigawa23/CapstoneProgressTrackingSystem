import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { columns } from "../../constants"
import type { ColumnId, TodoItem } from "../../types"
import { DashboardTaskCard } from "../dashboard-task-card"
import type { OpenTaskTarget, Person } from "./types"

type DashboardColumnProps = {
  column: (typeof columns)[number]
  todos: TodoItem[]
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onOpenTask: (todo: TodoItem, target?: OpenTaskTarget) => void
  onCreate: (status: ColumnId) => void
  className?: string
  scrollAreaClassName?: string
}

export function DashboardColumn({
  column,
  todos,
  people,
  onStatusChange,
  onOpenTask,
  onCreate,
  className = "",
  scrollAreaClassName,
}: DashboardColumnProps) {
  const hasTodos = todos.length > 0

  return (
    <Card
      className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl dark:border-[#343434] dark:bg-[#1f1f1f] ${className}`}
    >
      <CardHeader className="px-3 pb-2 pt-3">
        <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold dark:text-slate-100">
          <span className={`h-2 w-2 rounded-full ${column.color}`} />
          <span className="truncate">{column.title}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
        <ScrollArea
          className={
            scrollAreaClassName ??
            (hasTodos
              ? `
                  w-full max-h-[180px]
                  sm:max-h-[260px]
                  lg:max-h-[340px]
                  xl:max-h-[420px]
                `
              : "min-h-[170px] w-full")
          }
        >
          <div className={`space-y-2 p-0.5 pr-2 ${hasTodos ? "" : "h-full"}`}>
            {todos.map((todo) => (
              <DashboardTaskCard
                key={todo.id}
                todo={todo}
                people={people}
                onStatusChange={onStatusChange}
                onOpen={onOpenTask}
              />
            ))}

            {todos.length === 0 && (
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                No tasks in this column.
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <div className="border-t border-slate-200 p-1 dark:border-[#343434]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCreate(column.id)}
          className="w-full justify-start gap-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-100"
        >
          <Plus className="h-3 w-3" />
          Create
        </Button>
      </div>
    </Card>
  )
}
