import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
}

export function DashboardBoard({ todos, people }: DashboardBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => {
        const columnTodos = todos.filter((todo) => todo.status === column.id)

        return (
          <Card key={column.id} className="flex min-w-0 flex-col rounded-xl">
            <CardHeader className="px-3 pb-2 pt-3">
              <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={`h-2 w-2 rounded-full ${column.color}`} />
                <span className="truncate">{column.title}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-2 pt-0">
              <div
                className="
                  min-h-[180px] space-y-2 p-0.5
                  sm:min-h-[260px]
                  lg:min-h-[340px]
                  xl:min-h-[420px]
                "
              >
                {columnTodos.map((todo) => (
                  <DashboardTaskCard
                    key={todo.id}
                    todo={todo}
                    people={people}
                  />
                ))}

                {columnTodos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tasks in this column.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
