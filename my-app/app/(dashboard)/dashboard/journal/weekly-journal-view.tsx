"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Download, ListChecks, Loader2, RefreshCw, Save, ShieldCheck, Sparkles, Target, TriangleAlert, Trophy, Upload, UserRoundCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type StoredStatus = "approved" | "submitted" | "draft"
type Fields = {
  weeklyObjectives: string; workCompleted: string; memberContributions: string
  challenges: string; actionsTaken: string; nextWeekPlan: string
  adviserFeedback: string
}
type Entry = Fields & { id: string; weekNumber: number; status: StoredStatus; submittedAt: string | null; approvedAt: string | null; adviserReviewedAt: string | null }
type AutoSummary = Omit<Fields, "adviserFeedback"> & {
  weekNumber: number; tasksCreated: number; tasksCompleted: number; revisions: number; delayed: number
  completedTasks: string[]
  revisionTasks?: { title: string; when?: string; subtasks: string[] }[]
  subtasks?: string[]
}
type Week = { week: number; dateRange: string }

const EMPTY: Fields = { weeklyObjectives: "", workCompleted: "", memberContributions: "", challenges: "", actionsTaken: "", nextWeekPlan: "", adviserFeedback: "" }
const FIELD_DEFINITIONS = [
  { key: "weeklyObjectives", title: "Weekly objectives", description: "Goals and priorities scheduled for this week.", icon: Target, accent: "text-blue-500", iconBackground: "bg-blue-500/10" },
  { key: "workCompleted", title: "Work completed", description: "Finished tasks and measurable project progress.", icon: Trophy, accent: "text-emerald-500", iconBackground: "bg-emerald-500/10" },
  { key: "challenges", title: "Challenges", description: "Blockers, revisions, and issues encountered.", icon: TriangleAlert, accent: "text-orange-500", iconBackground: "bg-orange-500/10" },
  { key: "actionsTaken", title: "Actions taken", description: "Steps completed to move the project forward.", icon: ListChecks, accent: "text-cyan-500", iconBackground: "bg-cyan-500/10" },
] satisfies Array<{ key: keyof Fields; title: string; description: string; icon: typeof Target; accent: string; iconBackground: string }>
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
function JournalStatusBadge({ entry }: { entry?: Entry }) {
  const approved = entry?.status === "approved"
  if (!approved && !entry?.adviserReviewedAt) return null

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium", approved ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300")}>
      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
      {approved ? "Approved" : "Reviewed by adviser"}
    </span>
  )
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

function getActivityStyle(content: string) {
  const normalized = content.toLowerCase()
  if (normalized.includes("upload") || normalized.includes("submitted evidence")) return { icon: Upload, label: "File submission", color: "text-violet-500", background: "bg-violet-500/10" }
  if (normalized.includes("completed")) return { icon: CheckCircle2, label: "Completed", color: "text-emerald-500", background: "bg-emerald-500/10" }
  if (normalized.includes("revision")) return { icon: TriangleAlert, label: "Revision", color: "text-orange-500", background: "bg-orange-500/10" }
  if (normalized.includes("delayed") || normalized.includes("overdue")) return { icon: Clock3, label: "Delayed", color: "text-red-500", background: "bg-red-500/10" }
  if (normalized.includes("assigned") || normalized.includes("contribution")) return { icon: UserRoundCheck, label: "Assignment", color: "text-cyan-500", background: "bg-cyan-500/10" }
  if (normalized.includes("created")) return { icon: Sparkles, label: "Task created", color: "text-blue-500", background: "bg-blue-500/10" }
  if (normalized.includes("moved") || normalized.includes("changed")) return { icon: RefreshCw, label: "Task updated", color: "text-amber-500", background: "bg-amber-500/10" }
  return { icon: Target, label: "Project activity", color: "text-[var(--brand-primary-fixed)]", background: "bg-[color:rgba(var(--brand-primary-rgb),0.10)]" }
}

function parseActivityLine(value: string) {
  const line = value.replace(/^[•*-]\s*/, "").trim()
  const separator = line.lastIndexOf(" — ")
  if (separator < 0) return { text: line, detail: "" }
  const possibleDetail = line.slice(separator + 3).trim()
  const looksLikeDateOrDetail = /\b(?:am|pm|due|priority|not set)\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(possibleDetail)
  return looksLikeDateOrDetail
    ? { text: line.slice(0, separator).trim(), detail: possibleDetail }
    : { text: line, detail: "" }
}

function ActivityList({ content }: { content: string }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const activities = React.useMemo(
    () => content.split("\n").map(parseActivityLine).filter((item) => item.text),
    [content]
  )

  React.useLayoutEffect(() => {
    const list = scrollRef.current
    if (!list) return
    list.scrollTop = 0

    const cards = Array.from(list.children) as HTMLElement[]
    const updateHeight = () => {
      const first = cards[0]
      const last = cards[Math.min(cards.length, 5) - 1]
      list.style.maxHeight = first && last
        ? `${last.getBoundingClientRect().bottom - first.getBoundingClientRect().top}px`
        : ""
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    cards.slice(0, 5).forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [content])

  return <div ref={scrollRef} tabIndex={0} role="region" aria-label="Journal activities" className="mt-3 min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 print:max-h-none! print:overflow-visible">
    {activities.map((activity, index) => {
      const style = getActivityStyle(activity.text)
      const Icon = style.icon
      return <div key={`${activity.text}-${index}`} className="flex gap-3 rounded-xl border border-border bg-muted/25 px-3 py-2.5">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", style.background, style.color)}><Icon className="h-3.5 w-3.5" /></div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[10px] font-semibold uppercase tracking-wide", style.color)}>{style.label}</p>
          <p className="mt-0.5 break-words text-[11px] leading-4 text-foreground">{activity.text}</p>
          {activity.detail ? <p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 className="h-2.5 w-2.5" />{activity.detail}</p> : null}
        </div>
      </div>
    })}
  </div>
}

type Props = { groupCreatedAt: string; projectName: string; projectId: string; initialNow: string; initialWeek?: number; canApprove: boolean; isPrivacyRestricted: boolean; userRole: string; members: string[]; advisers: string[] }

export function WeeklyJournalView({ groupCreatedAt, projectName, projectId, initialNow, initialWeek, canApprove, isPrivacyRestricted, userRole, members = [], advisers = [] }: Props) {
  const [now, setNow] = React.useState(() => new Date(initialNow).getTime())
  const [selected, setSelected] = React.useState<Week | null>(() =>
    makeWeeks(groupCreatedAt, new Date(initialNow).getTime()).find((week) => week.week === initialWeek) ?? null)
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [autoSummaries, setAutoSummaries] = React.useState<AutoSummary[]>([])
  const [form, setForm] = React.useState<Fields>(EMPTY)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const weeks = React.useMemo(() => makeWeeks(groupCreatedAt, now), [groupCreatedAt, now])
  const entry = selected ? entries.find((item) => item.weekNumber === selected.week) : undefined
  const autoSummary = selected ? autoSummaries.find((item) => item.weekNumber === selected.week) : undefined
  const adviserCanReview = userRole === "faculty" && (!entry || ((entry.status === "draft" || entry.status === "submitted") && !entry.adviserReviewedAt))

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    fetch(`/api/weekly-journals?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to load journals"); setEntries(data.entries); setAutoSummaries(data.autoSummaries ?? []) })
      .catch((error) => { if (error.name !== "AbortError") setLoadError(error.message) })
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

  async function update(action: "feedback" | "approve") {
    if (!selected || saving) return
    setSaving(true); setMessage("")
    try {
      const response = await fetch("/api/weekly-journals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, weekNumber: selected.week, action, ...form }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update journal")
      setEntries((current) => [...current.filter((item) => item.weekNumber !== data.entry.weekNumber), data.entry])
      setMessage(action === "approve" ? "Journal approved." : "Feedback saved. Journal marked as reviewed by adviser.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to update journal") }
    finally { setSaving(false) }
  }

  const printDate = (value: string | null | undefined) => value ? formatDate(new Date(value)) : "________________"

  async function downloadPdf() {
    if (!selected) return
    let exportSummary: AutoSummary | undefined
    try {
      const response = await fetch(`/api/weekly-journals?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Could not load the latest journal for export.")
      const data = (await response.json()) as { autoSummaries: AutoSummary[]; privacyRestricted: boolean }
      if (data.privacyRestricted) return
      exportSummary = data.autoSummaries.find((summary) => summary.weekNumber === selected.week)
    } catch {
      setMessage("Could not load the latest journal for export.")
      return
    }
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const clean = (value: string) => value.replace(/•/g, "-").replace(/[—–]/g, "-")
    const left = 15
    const width = 180
    const column = width / 2
    const completed = exportSummary?.completedTasks ?? []
    const formatTaskGroup = (heading: string, subtasks: string[]) => [
      `- ${heading}`,
      ...subtasks.map((subtask) => `\u00a0\u00a0\u00a0- ${subtask} (subtask)`),
    ].join("\n")
    const legacySubtasksByParent = new Map<string, string[]>()
    for (const label of exportSummary?.subtasks ?? []) {
      const match = /^(.+) \(([^()]*(?:\([^()]*\)[^()]*)*)\)$/.exec(label)
      if (!match) continue
      const [, title, parent] = match
      legacySubtasksByParent.set(parent, [...(legacySubtasksByParent.get(parent) ?? []), title])
    }
    const legacyRevisions = (exportSummary?.challenges ?? "").split("\n").flatMap((line) => {
      const match = /^\s*(?:\u2022\s*)?Revision required:\s*(.+)$/.exec(line)
      if (!match) return []
      const title = match[1].replace(/\s+[\u2014\u2013-]\s+\w{3} \d{1,2}, \d{1,2}:\d{2}\s*[AP]M$/i, "")
      return [{ title, subtasks: legacySubtasksByParent.get(title) ?? [] }]
    })
    const revisionTasks = exportSummary?.revisionTasks ?? legacyRevisions
    const revisions = revisionTasks.map(({ title, subtasks }) => formatTaskGroup(title, subtasks))
    const feedback = form.adviserFeedback.trim()
    const activity = completed.length
      ? completed.map((task) => `- ${task}`).join("\n\n")
      : "No completed tasks recorded for this week."
    const remarks = [
      revisions.length > 0 && `Revisions\n${revisions.join("\n")}`,
      feedback && `Adviser feedback\n${feedback}`,
    ].filter(Boolean).join("\n\n") || "No remarks recorded."

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
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    const activityLines = pdf.splitTextToSize(clean(activity), column - 10) as string[]
    const remarkLines = pdf.splitTextToSize(clean(remarks), column - 10) as string[]
    const linesPerPage = 25
    const pageCount = Math.ceil(Math.max(activityLines.length, remarkLines.length) / linesPerPage)
    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) {
        pdf.addPage()
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(12)
        pdf.text(`Week ${selected.week} journal (continued)`, left, 27)
      }
      pdf.setFillColor(75, 75, 75); pdf.setTextColor(255, 255, 255)
      pdf.rect(left, tableTop, column, headerHeight, "FD"); pdf.rect(left + column, tableTop, column, headerHeight, "FD")
      pdf.setFontSize(7); pdf.setFont("helvetica", "bold")
      pdf.text("ACTIVITY / ACCOMPLISHMENT", left + column / 2, tableTop + 7, { align: "center" })
      pdf.text("REMARKS / COMMENTS / SUGGESTIONS /", left + column + column / 2, tableTop + 5, { align: "center" })
      pdf.text("DELIVERABLES AND DUE DATE", left + column + column / 2, tableTop + 9, { align: "center" })
      pdf.setTextColor(0, 0, 0); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9)
      pdf.rect(left, tableTop + headerHeight, column, bodyHeight); pdf.rect(left + column, tableTop + headerHeight, column, bodyHeight)
      const firstLine = page * linesPerPage
      pdf.text(activityLines.slice(firstLine, firstLine + linesPerPage), left + 5, tableTop + headerHeight + 7, { lineHeightFactor: 1.25 })
      pdf.text(remarkLines.slice(firstLine, firstLine + linesPerPage), left + column + 5, tableTop + headerHeight + 7, { lineHeightFactor: 1.25 })
    }

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
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7)
      pdf.line(left, 284, left + width, 284)
      pdf.text(`ACCOMPLISHMENT AND CONSULTATION FORM | FT-CRD-187-00 | PAGE ${page} OF ${pageCount}`, 105, 289, { align: "center" })
    }
    const filename = `${projectName}-Week-${selected.week}-Weekly-Journal.pdf`.replace(/[\\/:*?"<>|]/g, "-")
    pdf.save(filename)
  }

  return <div className="h-full overflow-y-auto pb-8 pr-1"><div className="mx-auto w-full max-w-[1440px] space-y-5 print:hidden">
    <header className="flex items-center gap-3 border-b border-border pb-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color:rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary-fixed)] dark:text-cyan-300">
        <BookOpen className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Weekly Journal</h1>
    </header>
    {loadError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">{loadError}</p> : null}
    {!selected ? <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Journal weeks</h2><p className="text-xs text-muted-foreground">Select a week to view its journal entry.</p></div><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{weeks.length} {weeks.length === 1 ? "week" : "weeks"}</div></div>
      {loading ? <div className="flex h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{weeks.map((week) => { const saved = entries.find((item) => item.weekNumber === week.week); const automatic = autoSummaries.find((item) => item.weekNumber === week.week); const hasAutomatic = automatic && Object.entries(automatic).some(([key, value]) => key !== "weekNumber" && typeof value === "string" && value.length > 0); return <button key={week.week} onClick={() => setSelected(week)} className="group rounded-[6px] border bg-background p-3 text-left hover:bg-muted/40"><div className="flex justify-between"><div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-sm font-semibold">{week.week}</div><JournalStatusBadge entry={saved} /></div><h3 className="mt-3 text-sm font-semibold">Week {week.week}</h3><p className="text-xs text-muted-foreground">{week.dateRange}</p><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{saved || hasAutomatic ? "Open journal entry" : "No journal entry yet."}</span><ArrowRight className="h-3.5 w-3.5" /></div></button> })}</div>}
    </section> : <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden"><button onClick={() => setSelected(null)} className="inline-flex h-8 items-center gap-2 rounded-[6px] border bg-card px-3 text-xs font-medium"><ArrowLeft className="h-3.5 w-3.5" />Back to weeks</button><div className="flex gap-2">
        {!isPrivacyRestricted ? <button type="button" onClick={downloadPdf} className="inline-flex h-8 items-center gap-2 rounded-[6px] border px-3 text-xs"><Download className="h-3.5 w-3.5" />Download PDF</button> : null}
        {canApprove && entry?.status === "submitted" && entry.adviserReviewedAt ? <button disabled={saving} onClick={() => update("approve")} className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-emerald-600 px-3 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />Approve journal</button> : null}
      </div></div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-[var(--border)] dark:bg-[var(--card)] dark:shadow-none"><div className="flex items-start justify-between border-b bg-gradient-to-r from-[color:rgba(var(--brand-primary-rgb),0.12)] via-transparent to-transparent p-5"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-primary-fixed)] text-white shadow-sm"><BookOpen className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-fixed)]">Weekly progress report</p><h2 className="mt-0.5 font-display text-base font-semibold">Week {selected.week} journal</h2><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{selected.dateRange}</p></div></div><JournalStatusBadge entry={entry} /></div>
        {isPrivacyRestricted ? <div className="space-y-4 p-4">
          <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><ShieldCheck className="h-4.5 w-4.5" /></div>
            <div><h3 className="text-sm font-semibold">Journal content is privacy protected</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Student notes, activity details, adviser feedback, filenames, comments, and PDF export are hidden from the Superadmin. Only status and aggregate progress are available.</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Tasks created", value: autoSummary?.tasksCreated ?? 0, color: "text-blue-500" },
              { label: "Tasks completed", value: autoSummary?.tasksCompleted ?? 0, color: "text-emerald-500" },
              { label: "Revisions", value: autoSummary?.revisions ?? 0, color: "text-orange-500" },
              { label: "Delayed", value: autoSummary?.delayed ?? 0, color: "text-red-500" },
            ].map((item) => <div key={item.label} className="rounded-lg border bg-background p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p><p className={cn("mt-2 text-xl font-semibold", item.color)}>{item.value}</p></div>)}
          </div>
        </div> : <>
        <Tabs key={`${projectId}-${selected.week}`} defaultValue="weeklyObjectives" className="gap-4 p-4">
          <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-1.5">
            <TabsList aria-label="Weekly journal sections" className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0 md:grid-cols-4">
              {FIELD_DEFINITIONS.map(({ key, title, icon: Icon }) => (
                <TabsTrigger key={key} value={key} className="h-auto min-h-10 min-w-0 justify-start whitespace-normal rounded-lg px-2 py-2 text-left text-xs leading-tight data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-[var(--brand-primary-fixed)] dark:data-[state=active]:text-cyan-300 sm:px-3">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />{title}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {FIELD_DEFINITIONS.map(({ key, title, description, icon: Icon, accent, iconBackground }) => {
          const automaticValue = autoSummary?.[key as keyof Omit<AutoSummary, "weekNumber">] ?? ""
          const automatic = typeof automaticValue === "string" ? automaticValue : ""
          return <TabsContent key={key} value={key} className="min-w-0"><div className="flex min-h-80 flex-col rounded-lg border bg-background p-4 sm:p-5"><div className="flex shrink-0 items-start gap-3"><div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", iconBackground, accent)}><Icon className="h-4 w-4" /></div><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p></div></div>{automatic ? <ActivityList content={automatic} /> : <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-3 text-center"><Icon className={cn("h-5 w-5 opacity-60", accent)} /><p className="mt-1.5 text-[11px] font-medium">Nothing recorded yet</p><p className="mt-0.5 text-[10px] text-muted-foreground">Updates will appear automatically from group activity.</p></div>}{form[key] ? <div className="mt-4 border-t pt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Student notes</p><p className="mt-1 whitespace-pre-line text-xs leading-5">{form[key]}</p></div> : null}</div></TabsContent>
        })}</Tabs>
        <div className="mx-4 mb-4 rounded-lg border bg-background p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-xs font-semibold">Adviser feedback</span><p className="mt-0.5 text-[10px] text-muted-foreground">Comments, recommendations, and confirmation from the assigned adviser.</p></div>{entry?.adviserFeedback.trim() ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" aria-hidden="true" />Reviewed by adviser</span> : null}</div>{adviserCanReview ? <textarea aria-label="Adviser feedback" value={form.adviserFeedback} onChange={(event) => setForm((value) => ({ ...value, adviserFeedback: event.target.value }))} placeholder="Write feedback for this week…" maxLength={5000} className="mt-3 min-h-24 w-full resize-none rounded-md border bg-muted/10 p-3 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-[var(--brand-primary-fixed)]" /> : form.adviserFeedback.trim() ? <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">{form.adviserFeedback}</p> : <p className="mt-3 text-sm text-muted-foreground">No adviser feedback yet.</p>}{adviserCanReview ? <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => update("feedback")} className="inline-flex h-8 items-center gap-2 rounded-[6px] bg-[var(--brand-primary-fixed)] px-3 text-xs font-semibold text-white disabled:opacity-60"><Save className="h-3.5 w-3.5" />Save feedback</button></div> : null}</div>
        </>}
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      </section>
    </div>}
  </div></div>
}
