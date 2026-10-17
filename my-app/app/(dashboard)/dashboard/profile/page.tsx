import Link from "next/link"
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Mail,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { roleLabels, type UserRole } from "@/lib/rbac"
import { getTrustedNowMs } from "@/lib/trusted-time"
import { listWeeklyJournals } from "@/lib/server-weekly-journal-repository"
import { getSelectedProjectData } from "../data"

export const dynamic = "force-dynamic"

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TS"
}

function formatDate(value: string | null) {
  if (!value) return "No due date"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

export default async function ProfilePage() {
  const user = await readAuthenticatedUser()
  if (!user?.id) return null

  const { projects, selectedProject, items } = await getSelectedProjectData()
  const isCoordinator = user.id === "tester-coordinator"
  const isAdviser = user.role === "faculty"
  const assignedTasks = items.filter((item) => item.assigneeId === user.id && !item.archived && !item.deleted)
  const completed = assignedTasks.filter((item) => item.status === "completed").length
  const inProgress = assignedTasks.filter((item) => item.status === "inprogress" || item.status === "inreview").length
  const now = getTrustedNowMs()
  const overdue = assignedTasks.filter((item) =>
    item.status !== "completed" && item.dueDate && new Date(item.dueDate).getTime() < now
  ).length
  const recentTasks = [...assignedTasks]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5)
  const role = user.role as UserRole
  const profileRoleLabel = isCoordinator ? "Coordinator" : roleLabels[role]

  const projectTasks = items.filter((item) => !item.archived && !item.deleted)
  const adviserPending = projectTasks.filter((item) => item.status === "inreview").length
  const adviserCompleted = projectTasks.filter((item) => item.status === "completed").length
  const adviserRevisions = projectTasks.filter((item) => item.status === "revision").length
  const journals = isCoordinator
    ? (await Promise.all(projects.map((project) => listWeeklyJournals(project.id)))).flat()
    : []
  const awaitingApproval = journals.filter((entry) => entry.status === "submitted" && entry.adviserReviewedAt).length
  const approvedJournals = journals.filter((entry) => entry.status === "approved").length
  const awaitingAdviser = journals.filter((entry) => entry.status === "submitted" && !entry.adviserReviewedAt).length

  const stats = isCoordinator
    ? [
        { label: "Groups", value: projects.length, icon: UsersRound, color: "text-blue-500" },
        { label: "For approval", value: awaitingApproval, icon: CircleDot, color: "text-amber-500" },
        { label: "Approved", value: approvedJournals, icon: CheckCircle2, color: "text-emerald-500" },
        { label: "With adviser", value: awaitingAdviser, icon: CalendarClock, color: "text-violet-500" },
      ]
    : isAdviser
      ? [
          { label: "Group tasks", value: projectTasks.length, icon: BriefcaseBusiness, color: "text-blue-500" },
          { label: "For review", value: adviserPending, icon: CircleDot, color: "text-amber-500" },
          { label: "Completed", value: adviserCompleted, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Revisions", value: adviserRevisions, icon: CalendarClock, color: "text-red-500" },
        ]
      : [
          { label: "Assigned", value: assignedTasks.length, icon: BriefcaseBusiness, color: "text-blue-500" },
          { label: "In progress", value: inProgress, icon: CircleDot, color: "text-amber-500" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Overdue", value: overdue, icon: CalendarClock, color: "text-red-500" },
        ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand-primary-fixed)]">Account</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">View your account, project, and task progress in one place.</p>
        </div>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f] dark:shadow-none">
          <div className="h-20 bg-gradient-to-r from-[var(--brand-primary-fixed)] to-blue-400/70" />
          <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <Avatar className="-mt-8 h-20 w-20 shrink-0 border-4 border-card dark:border-[#1f1f1f]">
                <AvatarFallback className="bg-[var(--brand-primary-fixed)] text-xl font-bold text-white">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 pb-1">
                <h2 className="truncate font-display text-xl font-bold">{user.name}</h2>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Badge variant="secondary" className="w-fit gap-1.5 rounded-full px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-primary-fixed)]" />
              {profileRoleLabel}
            </Badge>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
          <div className="space-y-5">
            <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
              <h3 className="font-display font-semibold">Account information</h3>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Full name</p><p className="text-sm font-medium">{user.name}</p></div></div>
                <div className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 text-muted-foreground" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Microsoft account</p><p className="truncate text-sm font-medium">{user.email}</p></div></div>
                <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">System role</p><p className="text-sm font-medium">{profileRoleLabel}</p></div></div>
              </div>
            </section>

            {!isCoordinator ? <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
              <h3 className="font-display font-semibold">{isCoordinator ? "Coordination scope" : isAdviser ? "Assigned group" : "Current project"}</h3>
              {selectedProject ? <div className="mt-4 space-y-3">
                <div className="flex gap-3"><BriefcaseBusiness className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Project / group</p><p className="text-sm font-medium">{selectedProject.name}</p></div></div>
                <div className="flex gap-3"><UsersRound className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Program and year</p><p className="text-sm font-medium">{[selectedProject.program, selectedProject.yearLevel].filter(Boolean).join(" · ") || "Not specified"}</p></div></div>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground dark:border-[#343434]">
                  {isCoordinator ? "Groups monitored" : isAdviser ? "Students" : "Adviser"}: <span className="font-medium text-foreground">{isCoordinator ? projects.length : isAdviser ? selectedProject.members.length : selectedProject.advisers.join(", ") || "Not assigned"}</span>
                </div>
              </div> : <p className="mt-4 text-sm text-muted-foreground">No project selected.</p>}
            </section> : null}
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-display font-semibold">{isCoordinator ? "Journal overview" : isAdviser ? "Review overview" : "Task progress"}</h3><p className="mt-0.5 text-xs text-muted-foreground">{isCoordinator ? "Weekly journals across all monitored groups." : isAdviser ? "Task review workload for the selected group." : "Tasks assigned to you in the current project."}</p></div><Link href={isCoordinator ? "/dashboard/journal" : "/dashboard/board"} className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--brand-primary-fixed)] hover:underline">{isCoordinator ? "View journals" : "View board"} <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-lg border bg-muted/20 p-3 dark:border-[#343434]"><Icon className={`h-4 w-4 ${color}`} /><p className="mt-3 text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
              </div>
            </section>

            {!isCoordinator ? <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
              <h3 className="font-display font-semibold">{isCoordinator ? "Monitored groups" : isAdviser ? "Recent group tasks" : "Recent assigned tasks"}</h3>
              <div className="mt-3 divide-y dark:divide-[#343434]">
                {isCoordinator ? projects.slice(0, 5).map((project) => <Link key={project.id} href="/dashboard/journal" className="flex items-center gap-3 py-3 hover:text-[var(--brand-primary-fixed)]"><UsersRound className="h-4 w-4 shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.members.length} members · {project.advisers.join(", ") || "No adviser"}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>) : (isAdviser ? projectTasks : recentTasks).slice(0, 5).map((task) => <Link key={task.id} href={`/dashboard/board?taskId=${encodeURIComponent(task.id)}`} className="flex items-center gap-3 py-3 hover:text-[var(--brand-primary-fixed)]"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "inprogress" || task.status === "inreview" ? "bg-amber-500" : "bg-slate-400"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}
                {(isCoordinator ? projects.length === 0 : (isAdviser ? projectTasks.length === 0 : recentTasks.length === 0)) ? <p className="py-8 text-center text-sm text-muted-foreground">No records yet.</p> : null}
              </div>
            </section> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
