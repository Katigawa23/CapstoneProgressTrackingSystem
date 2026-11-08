"use client"

import Link from "next/link"
import { ArrowUpRight, CalendarDays, CheckCheck, ListTodo } from "lucide-react"
import type { BacklogApiItem } from "../types"
import { PriorityBadge } from "./task-state-badges"
import { formatTrustedDate } from "@/lib/trusted-time"

type StudentTask = BacklogApiItem & { projectName: string }

export function StudentTodo({ items, userId, projectIds }: {
  items: StudentTask[]
  userId: string
  projectIds: string[]
}) {
  const priorityRank = { High: 0, Medium: 1, Low: 2 }
  const deadline = (value: string | null) => {
    const time = value ? new Date(value).getTime() : NaN
    return Number.isFinite(time) ? time : Infinity
  }
  const tasks = items.filter((item) =>
    item.assigneeId === userId && item.status !== "completed" &&
    !item.parentId && !item.archived && !item.deleted && projectIds.includes(item.projectId ?? "")
  ).sort((left, right) => {
    const priority = priorityRank[left.priority ?? "Medium"] - priorityRank[right.priority ?? "Medium"]
    if (priority) return priority
    const a = deadline(left.dueDate), b = deadline(right.dueDate)
    return a === b ? left.orderIndex - right.orderIndex : a < b ? -1 : 1
  })

  return (
    <section className="overflow-hidden rounded-xl border bg-card dark:border-[#343434] dark:bg-[#1f1f1f]" aria-labelledby="student-todo-title">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[color:rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary-fixed)]"><ListTodo className="size-4" /></div>
          <div><h2 id="student-todo-title" className="font-display text-sm font-semibold">To-do</h2><p className="text-xs text-muted-foreground">Your assigned tasks</p></div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold" aria-label={`${tasks.length} unfinished tasks`}>{tasks.length}</span>
      </div>
      {tasks.length ? (
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto overscroll-contain p-2" tabIndex={0} role="region" aria-label="Your unfinished tasks">
          {tasks.map((task) => (
            <Link key={task.id} href={`/dashboard/board?projectId=${encodeURIComponent(task.projectId ?? "")}&taskId=${encodeURIComponent(task.id)}`} className="group flex items-start gap-2 rounded-md border bg-background p-2 transition hover:border-[var(--brand-primary-fixed)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary-fixed)]">
              <div className="pt-0.5"><PriorityBadge priority={task.priority} iconOnly /></div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs font-semibold">{task.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{task.projectName}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" />{task.dueDate ? `Due ${formatTrustedDate(task.dueDate)}` : "No deadline"}</p>
              </div>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-[var(--brand-primary-fixed)]" />
            </Link>
          ))}
        </div>
      ) : <div className="px-4 py-6 text-center"><CheckCheck className="mx-auto size-7 text-emerald-500" /><p className="mt-3 text-sm font-medium">You&apos;re all caught up</p><p className="mt-1 text-xs text-muted-foreground">New tasks assigned to you will appear here.</p></div>}
    </section>
  )
}
