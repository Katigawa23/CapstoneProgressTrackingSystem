import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { columns } from "../constants"
import type { TodoItem } from "../types"
import { DashboardTaskCard } from "./dashboard-task-card"

type Person = {
  name: string
  src: string
}

type DashboardBoardProps = {
  todos: TodoItem[]
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
}

export function DashboardBoard({
  todos,
  people,
  onStatusChange,
}: DashboardBoardProps) {
  return (
    <div className="grid min-h-0 flex-1 items-start grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => {
        const columnTodos = todos.filter((todo) => todo.status === column.id)
        const hasTodos = columnTodos.length > 0

        return (
          <Card key={column.id} className="flex min-h-0 min-w-0 flex-col rounded-xl">
            <CardHeader className="px-3 pb-2 pt-3">
              <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={`h-2 w-2 rounded-full ${column.color}`} />
                <span className="truncate">{column.title}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
              <ScrollArea
                className={
                  hasTodos
                    ? `
                        min-h-[180px] flex-1
                        sm:min-h-[260px]
                        lg:min-h-[340px]
                        xl:min-h-[420px]
                      `
                    : "min-h-[170px] max-h-[170px]"
                }
              >
                <div className="space-y-2 p-0.5 pr-2">
                  {columnTodos.map((todo) => (
                    <DashboardTaskCard
                      key={todo.id}
                      todo={todo}
                      people={people}
                      onStatusChange={onStatusChange}
                    />
                  ))}

                  {columnTodos.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No tasks in this column.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
