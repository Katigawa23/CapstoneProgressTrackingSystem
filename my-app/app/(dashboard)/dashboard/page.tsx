"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search } from "lucide-react"

type ColumnId = "todo" | "inprogress" | "revision" | "completed"

const columns: { id: ColumnId; title: string; color: string }[] = [
  { id: "todo", title: "To-do", color: "bg-blue-500" },
  { id: "inprogress", title: "In Progress", color: "bg-yellow-500" },
  { id: "revision", title: "Revision", color: "bg-orange-500" },
  { id: "completed", title: "Completed", color: "bg-green-500" },
]

const people = [
  { name: "A", src: "" },
  { name: "B", src: "" },
  { name: "C", src: "" },
  { name: "D", src: "" },
]

export default function DashboardPage() {
  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Title / <span className="text-foreground">Travel Booking App</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Board</h1>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 w-full pl-9" placeholder="Search" />
            </div>

            <div className="flex items-center">
              {people.map((p, i) => (
                <Avatar
                  key={p.name}
                  className={`h-7 w-7 ring-2 ring-background ${
                    i === 0 ? "" : "-ml-2"
                  }`}
                >
                  <AvatarImage src={p.src} alt={p.name} />
                  <AvatarFallback className="text-[10px]">
                    {p.name}
                  </AvatarFallback>
                </Avatar>
              ))}
              <Avatar className="h-7 w-7 ring-2 ring-background -ml-2">
                <AvatarFallback className="text-[10px]">+</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban (responsive size) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <Card key={column.id} className="flex min-w-0 flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className={`h-3 w-3 rounded-full ${column.color}`} />
                <span className="truncate">{column.title}</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 pt-0">
              <div
                className="
                  rounded-md border border-dashed bg-muted/10
                  min-h-[220px]
                  sm:min-h-[320px]
                  lg:min-h-[420px]
                  xl:min-h-[520px]
                "
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}