"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, CircleDashed, Clock3, Download, FileText, Loader2, Save, Send } from "lucide-react"
import { cn } from "@/lib/utils"

type StoredStatus = "approved" | "submitted" | "draft"
type DisplayStatus = "Approved" | "Submitted" | "Draft" | "Not started"
type Fields = {
  weeklyObjectives: string; workCompleted: string; memberContributions: string
  challenges: string; actionsTaken: string; nextWeekPlan: string
  adviserFeedback: string
}
type Entry = Fields & { id: string; weekNumber: number; status: StoredStatus; submittedAt: string | null; approvedAt: string | null; adviserReviewedAt: string | null }
type AutoSummary = Omit<Fields, "adviserFeedback"> & {
  weekNumber: number; tasksCreated: number; tasksCompleted: number; revisions: number; delayed: number
}
type Week = { week: number; dateRange: string }

const EMPTY: Fields = { weeklyObjectives: "", workCompleted: "", memberContributions: "", challenges: "", actionsTaken: "", nextWeekPlan: "", adviserFeedback: "" }
const FIELD_DEFINITIONS: Array<[keyof Fields, string, string]> = [
  ["weeklyObjectives", "Weekly objectives", "List the goals the group plans to complete this week."],
  ["workCompleted", "Work completed", "Summarize completed tasks and project progress."],
  ["memberContributions", "Member contributions", "Record the contribution of every group member."],
  ["challenges", "Challenges", "Describe blockers or problems encountered by the group."],
  ["actionsTaken", "Actions taken", "Explain the solutions and actions used to address each challenge."],
  ["nextWeekPlan", "Next-week plan", "Outline the next tasks and priorities."],
]
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const statusStyles: Record<DisplayStatus, string> = {
  Approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
  Submitted: "border-blue-500/25 bg-blue-500/10 text-blue-500",
  Draft: "border-amber-500/25 bg-amber-500/10 text-amber-500",
  "Not started": "border-border bg-muted/40 text-muted-foreground",
}
function displayStatus(status?: StoredStatus): DisplayStatus {
  return status ? `${status[0].toUpperCase()}${status.slice(1)}` as DisplayStatus : "Not started"
}
function StatusIcon({ status }: { status: DisplayStatus }) {
  if (status === "Approved") return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === "Submitted") return <Clock3 className="h-3.5 w-3.5" />
  if (status === "Draft") return <FileText className="h-3.5 w-3.5" />
  return <CircleDashed className="h-3.5 w-3.5" />
}
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date)
}
function makeWeeks(created: string, now: number): Week[] {
  const parsed = new Date(created).getTime()
  const rawStart = Number.isNaN(parsed) ? now : parsed
  const start = Math.floor((rawStart + MANILA_OFFSET_MS) / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000) - MANILA_OFFSET_MS
  const count = Math.floor(Math.max(0, now - start) / WEEK_MS) + 1
  return Array.from({ length: count }, (_, index) => ({
    week: index + 1,
    dateRange: `${formatDate(new Date(start + index * WEEK_MS))} – ${formatDate(new Date(start + (index + 1) * WEEK_MS - 1))}`,
  }))
}

function ActivityList({ content }: { content: string }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [content])

  return <div ref={scrollRef} className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-transparent pt-1 pr-2 print:overflow-visible">
    <p className="whitespace-pre-line text-xs leading-5 text-foreground">{content}</p>
  </div>
}

type Props = { groupCreatedAt: string; projectName: string; projectId: string; initialNow: string; canApprove: boolean; userRole: string; members: string[]; advisers: string[] }

export function WeeklyJournalView({ groupCreatedAt, projectName, projectId, initialNow, canApprove, userRole, members = [], advisers = [] }: Props) {
  const [now, setNow] = React.useState(() => new Date(initialNow).getTime())
  const [selected, setSelected] = React.useState<Week | null>(null)
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [autoSummaries, setAutoSummaries] = React.useState<AutoSummary[]>([])
  const [form, setForm] = React.useState<Fields>(EMPTY)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const weeks = React.useMemo(() => makeWeeks(groupCreatedAt, now), [groupCreatedAt, now])
  const entry = selected ? entries.find((item) => item.weekNumber === selected.week) : undefined
  const autoSummary = selected ? autoSummaries.find((item) => item.weekNumber === selected.week) : undefined
  const hasAutomaticContent = autoSummary && Object.entries(autoSummary).some(([key, value]) => key !== "weekNumber" && typeof value === "string" && value.length > 0)
  const status: DisplayStatus = entry ? displayStatus(entry.status) : hasAutomaticContent ? "Draft" : "Not started"
  const studentCanEdit = userRole === "student" && (!entry || entry.status === "draft")
  const adviserCanReview = userRole === "faculty" && (!entry || ((entry.status === "draft" || entry.status === "submitted") && !entry.adviserReviewedAt))

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/weekly-journals?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to load journals"); setEntries(data.entries); setAutoSummaries(data.autoSummaries ?? []) })
      .catch((error) => { if (error.name !== "AbortError") setMessage(error.message) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [projectId])

  React.useEffect(() => { setForm(entry ? { ...EMPTY, ...entry } : EMPTY); setMessage("") }, [entry, selected])
  React.useEffect(() => {
    const parsedCreated = new Date(groupCreatedAt).getTime()
    if (Number.isNaN(parsedCreated)) return
    const created = Math.floor((parsedCreated + MANILA_OFFSET_MS) / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000) - MANILA_OFFSET_MS
    const next = created + (Math.floor(Math.max(0, Date.now() - created) / WEEK_MS) + 1) * WEEK_MS
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(next - Date.now(), 1000), 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [groupCreatedAt, now])

  async function update(action: "save" | "submit" | "feedback" | "approve") {
    if (!selected || saving) return
    setSaving(true); setMessage("")
    try {
      const response = await fetch("/api/weekly-journals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, weekNumber: selected.week, action, ...form }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update journal")
      setEntries((current) => [...current.filter((item) => item.weekNumber !== data.entry.weekNumber), data.entry])
      setMessage(action === "approve" ? "Journal approved." : action === "submit" ? "Journal submitted." : action === "feedback" ? "Feedback saved. Journal marked as checked by adviser." : "Changes saved.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to update journal") }
    finally { setSaving(false) }
  }

  const printDate = (value: string | null | undefined) => value ? formatDate(new Date(value)) : "________________"
  const printActivity = [autoSummary?.weeklyObjectives, autoSummary?.workCompleted, autoSummary?.memberContributions, autoSummary?.actionsTaken, form.weeklyObjectives, form.workCompleted, form.memberContributions, form.actionsTaken].filter(Boolean).join("\n") || "No recorded activity for this week."
  const printRemarks = [autoSummary?.challenges, autoSummary?.nextWeekPlan, form.challenges, form.nextWeekPlan, form.adviserFeedback].filter(Boolean).join("\n") || "No remarks recorded."

  async function downloadPdf() {
    if (!selected) return
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const clean = (value: string) => value.replace(/•/g, "-").replace(/[—–]/g, "-")
    const fitLines = (value: string, width: number, maximum: number) => {
      const lines = pdf.splitTextToSize(clean(value), width) as string[]
      return lines.length > maximum ? [...lines.slice(0, maximum - 1), "..."] : lines
    }
    const left = 15
    const width = 180
    const column = width / 2

    pdf.setTextColor(0, 0, 0)
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14)
    pdf.text("ACCOMPLISHMENT AND CONSULTATION FORM", 105, 17, { align: "center" })
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5)
    const instruction = "INSTRUCTION: List all the activities, improvements, or accomplishments in your Thesis/Capstone Project Documentation and System/Prototype. This form should be submitted to your Thesis/Capstone Project Adviser every week."
    pdf.text(pdf.splitTextToSize(instruction, width), left, 27)
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold")
    pdf.text(`Thesis/Capstone Project Title: ${clean(projectName)}`, left, 40)
    pdf.text(`Week Number: ${selected.week}`, left, 46)
    pdf.text(`Coverage: ${clean(selected.dateRange)}`, left, 52)

    const tableTop = 58
    const headerHeight = 12
    const bodyHeight = 108
    pdf.setFillColor(75, 75, 75); pdf.setTextColor(255, 255, 255)
    pdf.rect(left, tableTop, column, headerHeight, "FD"); pdf.rect(left + column, tableTop, column, headerHeight, "FD")
    pdf.setFontSize(7); pdf.setFont("helvetica", "bold")
    pdf.text("ACTIVITY / ACCOMPLISHMENT", left + column / 2, tableTop + 7, { align: "center" })
    pdf.text("REMARKS / COMMENTS / SUGGESTIONS /", left + column + column / 2, tableTop + 5, { align: "center" })
    pdf.text("DELIVERABLES AND DUE DATE", left + column + column / 2, tableTop + 9, { align: "center" })
    pdf.setTextColor(0, 0, 0); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5)
    pdf.rect(left, tableTop + headerHeight, column, bodyHeight); pdf.rect(left + column, tableTop + headerHeight, column, bodyHeight)
    pdf.text(fitLines(printActivity, column - 8, 25), left + 4, tableTop + headerHeight + 6, { lineHeightFactor: 1.25 })
    pdf.text(fitLines(printRemarks, column - 8, 25), left + column + 4, tableTop + headerHeight + 6, { lineHeightFactor: 1.25 })

    const signTop = tableTop + headerHeight + bodyHeight
    const signHeight = 92
    pdf.rect(left, signTop, column, signHeight); pdf.rect(left + column, signTop, column, signHeight)
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("Prepared by:", left + 4, signTop + 7)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7)
    const prepared = members.length ? members.slice(0, 6) : ["Group Members"]
    prepared.forEach((member, index) => {
      const y = signTop + 18 + index * 11
      pdf.text(`${clean(member)} / ${printDate(entry?.submittedAt)}`, left + column / 2, y, { align: "center", maxWidth: column - 8 })
      pdf.line(left + 4, y + 2, left + column - 4, y + 2)
      pdf.setFontSize(6); pdf.text("Name of Group Member / Date", left + column / 2, y + 5, { align: "center" }); pdf.setFontSize(7)
    })
    const rightCenter = left + column + column / 2
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("Checked by:", left + column + 4, signTop + 7)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7)
    pdf.text(clean(advisers[0] || "Thesis/Capstone Project Adviser"), rightCenter, signTop + 18, { align: "center" })
    pdf.line(left + column + 4, signTop + 20, left + width - 4, signTop + 20)
    pdf.setFontSize(6); pdf.text("Name of Thesis/Capstone Project Adviser", rightCenter, signTop + 24, { align: "center" })
    pdf.setFontSize(7); pdf.text(`Date Signed: ${printDate(entry?.adviserReviewedAt)}`, rightCenter, signTop + 34, { align: "center" })
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("Noted by:", left + column + 4, signTop + 47)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7)
    pdf.text("Thesis/Capstone Project Coordinator", rightCenter, signTop + 59, { align: "center" })
    pdf.line(left + column + 4, signTop + 61, left + width - 4, signTop + 61)
    pdf.setFontSize(6); pdf.text("Name of Thesis/Capstone Project Coordinator", rightCenter, signTop + 65, { align: "center" })
    pdf.setFontSize(7); pdf.text(`Date Signed: ${printDate(entry?.approvedAt)}`, rightCenter, signTop + 75, { align: "center" })
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7)
    pdf.line(left, 284, left + width, 284)
    pdf.text("ACCOMPLISHMENT AND CONSULTATION FORM | FT-CRD-187-00 | PAGE 1 OF 1", 105, 289, { align: "center" })
    const filename = `${projectName}-Week-${selected.week}-Weekly-Journal.pdf`.replace(/[\\/:*?"<>|]/g, "-")
    pdf.save(filename)
  }

  return <div className="h-full overflow-y-auto pb-8 pr-1"><div className="w-full space-y-5 print:hidden">
    <header className="space-y-1"><div className="flex gap-1 text-sm text-muted-foreground"><span>Project /</span><span className="text-foreground">{projectName}</span></div><h1 className="font-display text-xl font-semibold">Weekly Journal</h1><p className="text-sm text-muted-foreground">Keep a simple record of the group&apos;s progress every week.</p></header>
    {!selected ? <section className="rounded-[8px] border bg-card p-4">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Journal weeks</h2><p className="text-xs text-muted-foreground">Select a week to view its journal entry.</p></div><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{weeks.length} {weeks.length === 1 ? "week" : "weeks"}</div></div>
      {loading ? <div className="flex h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{weeks.map((week) => { const saved = entries.find((item) => item.weekNumber === week.week); const automatic = autoSummaries.find((item) => item.weekNumber === week.week); const hasAutomatic = automatic && Object.entries(automatic).some(([key, value]) => key !== "weekNumber" && typeof value === "string" && value.length > 0); const state: DisplayStatus = saved ? displayStatus(saved.status) : hasAutomatic ? "Draft" : "Not started"; return <button key={week.week} onClick={() => setSelected(week)} className="group rounded-[6px] border bg-background p-3 text-left hover:bg-muted/40"><div className="flex justify-between"><div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-sm font-semibold">{week.week}</div><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", statusStyles[state])}><StatusIcon status={state} />{state}</span></div><h3 className="mt-3 text-sm font-semibold">Week {week.week}</h3><p className="text-xs text-muted-foreground">{week.dateRange}</p><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{saved || hasAutomatic ? "Open journal entry" : "No journal entry yet."}</span><ArrowRight className="h-3.5 w-3.5" /></div></button> })}</div>}
    </section> : <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden"><button onClick={() => setSelected(null)} className="inline-flex h-8 items-center gap-2 rounded-[6px] border bg-card px-3 text-xs font-medium"><ArrowLeft className="h-3.5 w-3.5" />Back to weeks</button><div className="flex gap-2">
        <button type="button" onClick={downloadPdf} className="inline-flex h-8 items-center gap-2 rounded-[6px] border px-3 text-xs"><Download className="h-3.5 w-3.5" />Download PDF</button>
        {studentCanEdit ? <><button disabled={saving} onClick={() => update("save")} className="inline-flex h-8 items-center gap-2 rounded-[6px] border px-3 text-xs"><Save className="h-3.5 w-3.5" />Save draft</button><button disabled={saving} onClick={() => update("submit")} className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-[var(--brand-primary-fixed)] px-3 text-xs font-semibold text-white"><Send className="h-3.5 w-3.5" />Submit</button></> : null}
        {canApprove && entry?.status === "submitted" && entry.adviserReviewedAt ? <button disabled={saving} onClick={() => update("approve")} className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-emerald-600 px-3 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />Approve journal</button> : null}
      </div></div>
      <section className="rounded-[8px] border bg-card p-4"><div className="flex items-start justify-between border-b pb-3"><div className="flex gap-3"><div className="flex h-9 w-9 items-center justify-center rounded bg-muted"><BookOpen className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold">Week {selected.week} journal</h2><p className="text-xs text-muted-foreground">{selected.dateRange}</p></div></div><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px]", statusStyles[status])}><StatusIcon status={status} />{status}</span></div>
        {autoSummary ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Created</p><p className="text-lg font-semibold">{autoSummary.tasksCreated}</p></div><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Completed</p><p className="text-lg font-semibold text-emerald-500">{autoSummary.tasksCompleted}</p></div><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Revisions</p><p className="text-lg font-semibold text-orange-500">{autoSummary.revisions}</p></div><div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Delayed</p><p className="text-lg font-semibold text-red-500">{autoSummary.delayed}</p></div></div> : null}
        <div className="grid items-start gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">{FIELD_DEFINITIONS.map(([key, title]) => {
          const automaticValue = autoSummary?.[key as keyof Omit<AutoSummary, "weekNumber">] ?? ""
          const automatic = typeof automaticValue === "string" ? automaticValue : ""
          return <div key={key} className="flex h-48 flex-col overflow-hidden rounded-[6px] border bg-background p-3 print:h-auto print:overflow-visible"><h3 className="shrink-0 text-xs font-semibold">{title}</h3>{automatic ? <ActivityList content={automatic} /> : <p className="mt-2 text-xs text-muted-foreground">No recorded activity this week.</p>}{studentCanEdit ? <textarea aria-label={`${title} additional notes`} value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} placeholder="Add student notes..." maxLength={5000} className="mt-2 min-h-0 w-full flex-1 resize-none rounded border bg-transparent p-2 text-xs leading-5 outline-none placeholder:text-muted-foreground" /> : form[key] ? <div className="mt-2 min-h-0 overflow-y-auto border-t pt-2 print:overflow-visible"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Student notes</p><p className="mt-1 whitespace-pre-line text-xs">{form[key]}</p></div> : null}</div>
        })}</div>
        <div className="mt-3 rounded-[6px] border bg-background p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">Adviser feedback</span>{entry?.adviserReviewedAt ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-500"><CheckCircle2 className="h-3 w-3" />Checked by adviser</span> : entry?.status === "submitted" ? <span className="text-[10px] text-muted-foreground">Awaiting adviser feedback</span> : null}</div><textarea aria-label="Adviser feedback" value={form.adviserFeedback} disabled={!adviserCanReview} onChange={(event) => setForm((value) => ({ ...value, adviserFeedback: event.target.value }))} placeholder="Adviser comments and recommendations will appear here." maxLength={5000} className="mt-2 min-h-24 w-full resize-y bg-transparent text-xs leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-default" />{adviserCanReview ? <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => update("feedback")} className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-[var(--brand-primary-fixed)] px-3 text-xs font-semibold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />Save feedback</button></div> : null}</div>
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      </section>
    </div>}
  </div></div>
}
