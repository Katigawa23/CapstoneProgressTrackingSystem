import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Clock3,
  FileCheck2,
  MessageSquareText,
  Users,
} from "lucide-react"

import type { DashboardProject } from "@/lib/projects"
import type { BacklogApiItem } from "../types"

const cardClass =
  "rounded-lg border border-slate-200 bg-white p-3 dark:border-[#3a414b] dark:bg-[#202329]"

const statusStyles = {
  todo: { label: "To Do", color: "text-slate-600 dark:text-slate-300", bar: "bg-slate-400" },
  inprogress: { label: "In Progress", color: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  revision: { label: "Revision", color: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  completed: { label: "Completed", color: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
} as const

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "No date"
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase()
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-xs text-muted-foreground">{children}</p>
}

export function CoordinatorRoadmapOverview({ project, items }: {
  project: DashboardProject
  items: BacklogApiItem[]
}) {
  const now = new Date()
  const rootItems = items.filter((item) => !item.parentId)
  const statusCards = Object.entries(statusStyles).map(([status, style]) => ({
    ...style,
    value: rootItems.filter((item) => item.status === status).length,
  }))
  const largestStatusCount = Math.max(1, ...statusCards.map((status) => status.value))

  const upcomingDeadlines = rootItems
    .filter((item) => item.dueDate && item.status !== "completed" && new Date(item.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4)
  const completedMilestones = rootItems
    .filter((item) => item.status === "completed")
    .sort((a, b) => new Date(b.dueDate ?? b.createdAt ?? 0).getTime() - new Date(a.dueDate ?? a.createdAt ?? 0).getTime())
    .slice(0, 4)
  const delayedTasks = rootItems
    .filter((item) => item.dueDate && item.status !== "completed" && new Date(item.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4)
  const recentActivities = [...rootItems]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 4)
  const members = project.members.map((name, index) => {
    const userId = project.memberUserIds[index]
    const assigned = userId ? rootItems.filter((item) => item.assigneeId === userId) : []
    const completed = assigned.filter((item) => item.status === "completed").length
    return {
      name,
      initials: getInitials(name),
      assigned: assigned.length,
      completed,
      percent: assigned.length ? Math.round((completed / assigned.length) * 100) : 0,
    }
  })
  const feedbackItems = rootItems
    .filter((item) => item.status === "revision" || item.status === "completed")
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 4)

  return (
    <div className="space-y-3">
      <section className={cardClass}>
        <SectionHeading icon={FileCheck2} title="Tasks per status" description="Current distribution of all group tasks." />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((status) => (
            <div key={status.label} className="rounded-md border border-slate-200 p-2.5 dark:border-[#3a414b]">
              <div className="flex items-end justify-between gap-3">
                <p className={`text-sm font-medium ${status.color}`}>{status.label}</p>
                <p className="text-lg font-bold text-slate-950 dark:text-white">{status.value}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#303030]">
                <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${(status.value / largestStatusCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className={cardClass}>
          <SectionHeading icon={CalendarClock} title="Upcoming deadlines" description="Next task deadlines from this group." />
          <div className="mt-3">
            {!upcomingDeadlines.length ? <EmptyState>No upcoming deadlines.</EmptyState> : upcomingDeadlines.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-[#343a43]">
                <div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.priority ?? "Medium"} priority</p></div>
                <p className="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">{formatDate(item.dueDate)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={CircleCheck} title="Completed milestones" description="Completed tasks in this group." />
          <div className="mt-3 space-y-2.5">
            {!completedMilestones.length ? <EmptyState>No completed milestones yet.</EmptyState> : completedMilestones.map((item) => (
              <div key={item.id} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">Target date {formatDate(item.dueDate ?? item.createdAt)}</p></div></div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={AlertTriangle} title="Delayed tasks" description="Incomplete tasks past their deadline." tone="danger" />
          <div className="mt-3">
            {!delayedTasks.length ? <EmptyState>No delayed tasks.</EmptyState> : delayedTasks.map((item) => {
              const daysLate = Math.max(1, Math.ceil((now.getTime() - new Date(item.dueDate!).getTime()) / 86_400_000))
              return (
                <div key={item.id} className="border-b border-slate-100 py-2 last:border-0 dark:border-[#343a43]">
                  <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{item.title}</p><span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">{daysLate} {daysLate === 1 ? "day" : "days"} late</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">Due {formatDate(item.dueDate)}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={Clock3} title="Recent activity" description="Latest tasks created in this group." />
          <div className="mt-3 space-y-2.5">
            {!recentActivities.length ? <EmptyState>No recent activity.</EmptyState> : recentActivities.map((item) => (
              <div key={item.id} className="border-l-2 border-blue-500 pl-4"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{item.status} · {formatDate(item.createdAt)}</p></div>
            ))}
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <SectionHeading icon={Users} title="Group members’ progress" description="Assigned and completed tasks for every student." />
        {!members.length ? <EmptyState>No student members assigned.</EmptyState> : (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {members.map((member) => (
              <div key={member.name} className="rounded-md border border-slate-200 p-2.5 dark:border-[#3a414b]">
                <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{member.initials}</div><div><p className="font-semibold">{member.name}</p><p className="text-xs text-muted-foreground">{member.completed} of {member.assigned} tasks completed</p></div></div>
                <div className="mt-2 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-[#303030]"><div className="h-full rounded-full bg-blue-600" style={{ width: `${member.percent}%` }} /></div><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{member.percent}%</span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <SectionHeading icon={MessageSquareText} title="Adviser feedback timeline" description="Tasks currently for revision or already approved." />
        <div className="mt-3">
          {!feedbackItems.length ? <EmptyState>No revision or approval records yet.</EmptyState> : feedbackItems.map((item, index) => {
            const approved = item.status === "completed"
            return (
              <div key={item.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                {index < feedbackItems.length - 1 ? <div className="absolute left-[9px] top-5 h-full w-px bg-slate-200 dark:bg-[#3a3a3a]" /> : null}
                <div className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-4 border-white dark:border-[#202329] ${approved ? "bg-emerald-500" : "bg-amber-500"}`} />
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:justify-between"><div><p className="font-medium">{item.title} {approved ? "approved" : "needs revision"}</p><p className="mt-1 text-sm text-muted-foreground">{item.description || (approved ? "Task marked as completed." : "Task returned for revision.")}</p></div><p className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ icon: Icon, title, description, tone = "default" }: {
  icon: typeof CalendarClock
  title: string
  description: string
  tone?: "default" | "danger"
}) {
  return <div className="flex items-center gap-2.5"><Icon className={`h-4 w-4 ${tone === "danger" ? "text-red-500" : "text-muted-foreground"}`} /><div><h2 className="font-display text-sm font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div>
}
