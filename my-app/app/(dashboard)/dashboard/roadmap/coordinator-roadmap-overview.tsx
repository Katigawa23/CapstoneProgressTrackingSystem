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

const statusCards = [
  { label: "To Do", value: 8, color: "text-slate-600 dark:text-slate-300", bar: "bg-slate-400" },
  { label: "In Progress", value: 5, color: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  { label: "Revision", value: 2, color: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  { label: "Completed", value: 14, color: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
]

const deadlines = [
  { title: "Chapter 3 submission", type: "Submission", date: "September 18" },
  { title: "Prototype presentation", type: "Presentation", date: "October 6" },
  { title: "Final defense", type: "Defense", date: "January 15" },
]

const milestones = [
  { title: "Research proposal approved", date: "September 3" },
  { title: "Chapter 1 completed", date: "September 8" },
  { title: "System requirements finalized", date: "September 12" },
]

const delayedTasks = [
  { title: "Revise conceptual framework", due: "Due September 10", delay: "3 days late" },
  { title: "Upload interview transcripts", due: "Due September 11", delay: "2 days late" },
]

const activities = [
  { title: "Login module moved to Completed", meta: "Miguel · 20 minutes ago" },
  { title: "New task: Prepare presentation slides", meta: "Angela · 1 hour ago" },
  { title: "Prototype document submitted", meta: "Lara · Yesterday" },
]

const members = [
  { name: "Angela Torres", initials: "AT", assigned: 8, completed: 6, percent: 75 },
  { name: "Lara Perez", initials: "LP", assigned: 7, completed: 5, percent: 71 },
  { name: "Miguel Cruz", initials: "MC", assigned: 9, completed: 5, percent: 56 },
]

const feedback = [
  { title: "Chapter 2 approved", detail: "No further revisions required.", date: "September 12", approved: true },
  { title: "Revise methodology", detail: "Clarify the participant selection process.", date: "September 9", approved: false },
  { title: "Proposal approved", detail: "Group may proceed to development.", date: "September 3", approved: true },
]

const cardClass =
  "rounded-lg border border-slate-200 bg-white p-3 dark:border-[#3a414b] dark:bg-[#202329]"

export function CoordinatorRoadmapOverview() {
  return (
    <div className="space-y-3">
      <section className={cardClass}>
        <div className="mb-3 flex items-center gap-2.5">
          <FileCheck2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-display text-sm font-semibold">Tasks per status</h2>
            <p className="text-xs text-muted-foreground">Current distribution of all group tasks.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((status) => (
            <div key={status.label} className="rounded-md border border-slate-200 p-2.5 dark:border-[#3a414b]">
              <div className="flex items-end justify-between gap-3">
                <p className={`text-sm font-medium ${status.color}`}>{status.label}</p>
                <p className="text-lg font-bold text-slate-950 dark:text-white">{status.value}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#303030]">
                <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${Math.max(12, (status.value / 14) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className={cardClass}>
          <SectionHeading icon={CalendarClock} title="Upcoming deadlines" description="Next submissions, presentations, and defense dates." />
          <div className="mt-3 space-y-2">
            {deadlines.map((item) => (
              <div key={item.title} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-[#343a43]">
                <div>
                  <p className="font-medium text-slate-950 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.type}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-blue-700 dark:text-blue-300">{item.date}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={CircleCheck} title="Completed milestones" description="Requirements completed by the group." />
          <div className="mt-3 space-y-2.5">
            {milestones.map((item) => (
              <div key={item.title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-medium text-slate-950 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Completed {item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={AlertTriangle} title="Delayed tasks" description="Tasks that have passed their deadline." tone="danger" />
          <div className="mt-3 space-y-2">
            {delayedTasks.map((item) => (
              <div key={item.title} className="border-b border-slate-100 py-2 last:border-0 dark:border-[#343a43]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-slate-950 dark:text-slate-100">{item.title}</p>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">{item.delay}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.due}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading icon={Clock3} title="Recent activity" description="Latest task updates and submissions." />
          <div className="mt-3 space-y-2.5">
            {activities.map((item) => (
              <div key={item.title} className="border-l-2 border-blue-500 pl-4">
                <p className="font-medium text-slate-950 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <SectionHeading icon={Users} title="Group members’ progress" description="Assigned and completed tasks for every student." />
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {members.map((member) => (
            <div key={member.name} className="rounded-md border border-slate-200 p-2.5 dark:border-[#3a414b]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{member.initials}</div>
                <div>
                  <p className="font-semibold text-slate-950 dark:text-slate-100">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.completed} of {member.assigned} tasks completed</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-[#303030]">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${member.percent}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{member.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass}>
        <SectionHeading icon={MessageSquareText} title="Adviser feedback timeline" description="Revision requests and approvals from the adviser." />
        <div className="mt-3 space-y-0">
          {feedback.map((item, index) => (
            <div key={`${item.title}-${item.date}`} className="relative flex gap-2.5 pb-3 last:pb-0">
              {index < feedback.length - 1 ? <div className="absolute left-[9px] top-5 h-full w-px bg-slate-200 dark:bg-[#3a3a3a]" /> : null}
              <div className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-4 border-white dark:border-[#202329] ${item.approved ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-950 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <p className="shrink-0 text-xs font-medium text-muted-foreground">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ icon: Icon, title, description, tone = "default" }: { icon: typeof CalendarClock; title: string; description: string; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={`h-4 w-4 ${tone === "danger" ? "text-red-500" : "text-muted-foreground"}`} />
      <div>
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
