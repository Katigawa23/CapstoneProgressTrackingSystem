"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  Link2,
  MessageSquareText,
  Paperclip,
  Send,
} from "lucide-react"

import { cn } from "@/lib/utils"

type JournalStatus = "Approved" | "Submitted" | "Draft" | "Not started"

type JournalWeek = {
  week: number
  dateRange: string
  status: JournalStatus
  summary: string
}

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000

function formatJournalDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function createJournalWeeks(groupCreatedAt: string, nowMs: number): JournalWeek[] {
  const parsedCreatedAt = new Date(groupCreatedAt).getTime()
  const createdAt = Number.isNaN(parsedCreatedAt) ? nowMs : parsedCreatedAt
  const elapsed = Math.max(0, nowMs - createdAt)
  const visibleWeekCount = Math.floor(elapsed / WEEK_IN_MS) + 1

  return Array.from({ length: visibleWeekCount }, (_, index) => {
    const start = new Date(createdAt + index * WEEK_IN_MS)
    const end = new Date(createdAt + (index + 1) * WEEK_IN_MS - 1)

    return {
      week: index + 1,
      dateRange: `${formatJournalDate(start)} – ${formatJournalDate(end)}`,
      status: "Not started" as const,
      summary: "No journal entry yet.",
    }
  })
}

const statusStyles: Record<JournalStatus, string> = {
  Approved:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Submitted:
    "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Draft: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Not started": "border-border bg-muted/40 text-muted-foreground",
}

function StatusIcon({ status }: { status: JournalStatus }) {
  if (status === "Approved") return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === "Submitted") return <Clock3 className="h-3.5 w-3.5" />
  if (status === "Draft") return <FileText className="h-3.5 w-3.5" />
  return <CircleDashed className="h-3.5 w-3.5" />
}

type WeeklyJournalViewProps = {
  groupCreatedAt: string
  projectName: string
  initialNow: string
  canApprove: boolean
}

export function WeeklyJournalView({
  groupCreatedAt,
  projectName,
  initialNow,
  canApprove,
}: WeeklyJournalViewProps) {
  const [nowMs, setNowMs] = React.useState(() => new Date(initialNow).getTime())
  const [selectedWeek, setSelectedWeek] = React.useState<JournalWeek | null>(null)
  const [approvedWeeks, setApprovedWeeks] = React.useState<Set<number>>(() => new Set())
  const journalWeeks = React.useMemo(
    () => createJournalWeeks(groupCreatedAt, nowMs),
    [groupCreatedAt, nowMs]
  )

  React.useEffect(() => {
    const createdAt = new Date(groupCreatedAt).getTime()

    if (Number.isNaN(createdAt)) return

    const elapsed = Math.max(0, Date.now() - createdAt)
    const nextWeekStartsAt = createdAt + (Math.floor(elapsed / WEEK_IN_MS) + 1) * WEEK_IN_MS
    const delay = Math.min(
      Math.max(nextWeekStartsAt - Date.now(), 1_000),
      2_147_483_647
    )
    const timeout = window.setTimeout(() => setNowMs(Date.now()), delay)

    return () => window.clearTimeout(timeout)
  }, [groupCreatedAt, nowMs])

  return (
    <div className="h-full overflow-y-auto pb-8 pr-1">
      <div className="w-full space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Project /</span>
            <span className="text-foreground">{projectName}</span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Weekly Journal
          </h1>
          <p className="text-sm text-muted-foreground">
            Keep a simple record of the group&apos;s progress every week.
          </p>
        </div>

        {!selectedWeek ? (
        <section className="rounded-[8px] border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Journal weeks</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a week to view its journal entry.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {journalWeeks.length} {journalWeeks.length === 1 ? "week" : "weeks"}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {journalWeeks.map((item) => {
              const displayedStatus = approvedWeeks.has(item.week) ? "Approved" : item.status

              return (
                <button
                  key={item.week}
                  type="button"
                  onClick={() => setSelectedWeek(item)}
                  className="group rounded-[6px] border border-border bg-background p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[5px] bg-muted text-sm font-semibold text-foreground">
                      {item.week}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        statusStyles[displayedStatus]
                      )}
                    >
                      <StatusIcon status={displayedStatus} />
                      {displayedStatus}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    Week {item.week}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.dateRange}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate pr-3">{item.summary}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              )
            })}
          </div>
        </section>
        ) : null}

        {selectedWeek ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedWeek(null)}
              className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to weeks
            </button>

            {canApprove ? (
              <button
                type="button"
                disabled={approvedWeeks.has(selectedWeek.week)}
                onClick={() =>
                  setApprovedWeeks((current) => new Set(current).add(selectedWeek.week))
                }
                className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-[var(--brand-primary-fixed)] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {approvedWeeks.has(selectedWeek.week) ? "Approved" : "Approve journal"}
              </button>
            ) : null}
          </div>

        <section className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-muted">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Week {selectedWeek.week} journal
                </h2>
                <p className="text-xs text-muted-foreground">{selectedWeek.dateRange}</p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium",
                statusStyles[
                  approvedWeeks.has(selectedWeek.week) ? "Approved" : selectedWeek.status
                ]
              )}
            >
              <StatusIcon
                status={approvedWeeks.has(selectedWeek.week) ? "Approved" : selectedWeek.status}
              />
              {approvedWeeks.has(selectedWeek.week) ? "Approved" : selectedWeek.status}
            </span>
          </div>

          <div className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Weekly objectives", "List the goals the group plans to complete this week."],
              ["Work completed", "Summarize completed tasks and project progress."],
              ["Member contributions", "Record the contribution of every group member."],
              ["Challenges", "Describe blockers or problems encountered by the group."],
              ["Actions taken", "Explain the solutions and actions used to address each challenge."],
              ["Next-week plan", "Outline the next tasks and priorities."],
              ["Student reflection", "Write a short reflection about the week and lessons learned."],
              ["Adviser feedback", "Review comments and recommendations from the adviser."],
            ].map(([title, description]) => (
              <div key={title} className="min-h-24 rounded-[6px] border border-border bg-background p-3">
                <h3 className="text-xs font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[6px] border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground">
                    Attachments and evidence
                  </h3>
                </div>
                <span className="text-[10px] text-muted-foreground">2 files · 1 link</span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex min-w-0 items-center gap-2 rounded-[5px] border border-border p-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">Weekly report.pdf</p>
                    <p className="text-[10px] text-muted-foreground">PDF · 1.2 MB</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-[5px] border border-border p-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">Progress screenshot.png</p>
                    <p className="text-[10px] text-muted-foreground">Image · 640 KB</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-[5px] border border-border p-2.5">
                  <Link2 className="h-4 w-4 shrink-0 text-violet-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">Repository update</p>
                    <p className="text-[10px] text-muted-foreground">External link</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">Submission activity</h3>
              </div>
              <div className="mt-3 space-y-3">
                <div className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                    <Send className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-foreground">Journal submitted</p>
                    <p className="text-[10px] text-muted-foreground">September 14, 2026 · 4:30 PM</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-foreground">Reviewed by adviser</p>
                    <p className="text-[10px] text-muted-foreground">September 15, 2026 · 9:10 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
        ) : null}

        <p className="text-center text-[11px] text-muted-foreground">
          Design preview only — journal entries are not connected to the database yet.
        </p>
      </div>
    </div>
  )
}
