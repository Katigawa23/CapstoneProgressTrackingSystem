import {
  CalendarDays,
  MessageSquareMore,
  MoreHorizontal,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

import { columns } from "../constants"
import type { TodoItem } from "../types"
import { formatDeadline, getInitials } from "../utils"

type Person = {
  name: string
  src: string
}

type DashboardTaskCardProps = {
  todo: TodoItem
  people: Person[]
  onStatusChange: (todoId: string, nextStatus: TodoItem["status"]) => void
  onOpen: (todo: TodoItem, target?: "default" | "comments") => void
}

export function DashboardTaskCard({
  todo,
  people,
  onStatusChange,
  onOpen,
}: DashboardTaskCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
      onClick={() => onOpen(todo)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(todo)
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-slate-900">
          {todo.title}
        </h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 rounded-sm p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
              type="button"
              aria-label={`Open actions for ${todo.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-slate-200 bg-white text-slate-700"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem>Submit</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700">
                {columns.map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    className={
                      column.id === todo.status
                        ? "bg-slate-100 text-slate-900"
                        : undefined
                    }
                    onSelect={() => onStatusChange(todo.id, column.id)}
                  >
                    {column.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assignee</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40 border-slate-200 bg-white text-slate-700">
                <DropdownMenuItem>unassign</DropdownMenuItem>
                <DropdownMenuItem>kerby@gmail.com</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>Add Comment</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Archive</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-700">Assignees :</p>

        <div className="flex items-center">
          {people.slice(0, 2).map((person, index) => (
            <Avatar
              key={person.name}
              className={`h-4 w-4 border border-white ${
                index === 0 ? "" : "-ml-1"
              }`}
            >
              <AvatarImage src={person.src} alt={person.name} />
              <AvatarFallback className="bg-slate-100 text-[7px] text-slate-600">
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
        <CalendarDays className="h-3 w-3" />
        <span>{formatDeadline(todo.deadline)}</span>
      </div>

      <div className="my-2 h-px bg-slate-200" />

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <button
          type="button"
          className="flex items-center gap-1 rounded-sm transition hover:text-slate-700"
          aria-label={`Open comments for ${todo.title}`}
          onClick={(event) => {
            event.stopPropagation()
            onOpen(todo, "comments")
          }}
        >
          <MessageSquareMore className="h-3 w-3" />
          <span>{todo.comments}</span>
        </button>

      </div>
    </div>
  )
}
