"use client"

import * as React from "react"
import { BookOpen, CalendarDays, Check, CircleDashed, Layers3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type Task = { id: string; title: string; status: string; checked: boolean; dueDate: string | null; priority: string }
type Assignment = { taskId: string; chapter: number }
const chapters = [
  [1, "Chapter 1", "Introduction and project background"],
  [2, "Chapter 2", "Review of related literature and systems"],
  [3, "Chapter 3", "Methodology, requirements, and design"],
  [4, "Chapter 4", "Development, testing, and results"],
  [5, "Chapter 5", "Summary, conclusions, and recommendations"],
] as const
const isComplete = (task: Task) => task.checked || task.status === "completed"
function taskDate(value: string | null) {
  if (!value) return "No due date"

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)

  if (Number.isNaN(date.getTime())) return "No due date"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function MilestonesView({ projectId, projectName, canManage, tasks, initialAssignments }: { projectId: string | null; projectName: string; canManage: boolean; tasks: Task[]; initialAssignments: Assignment[] }) {
  const [selectedChapter, setSelectedChapter] = React.useState(1)
  const [assignments, setAssignments] = React.useState(initialAssignments)
  const [savingTaskId, setSavingTaskId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState("")
  const assignmentMap = React.useMemo(() => new Map(assignments.map((item) => [item.taskId, item.chapter])), [assignments])
  const selected = chapters[selectedChapter - 1]
  const selectedTasks = tasks.filter((task) => assignmentMap.get(task.id) === selectedChapter)
  const selectedCompleted = selectedTasks.filter(isComplete).length
  const assignedTasks = tasks.filter((task) => assignmentMap.has(task.id))
  const completedTasks = assignedTasks.filter(isComplete).length
  const overallProgress = assignedTasks.length ? Math.round(completedTasks / assignedTasks.length * 100) : 0
  const selectedProgress = selectedTasks.length ? Math.round(selectedCompleted / selectedTasks.length * 100) : 0

  async function changeChapter(taskId: string, value: string) {
    if (!projectId || !canManage) return
    const chapter = value ? Number(value) : null
    const previous = assignments
    setMessage("")
    setAssignments((current) => [...current.filter((item) => item.taskId !== taskId), ...(chapter ? [{ taskId, chapter }] : [])])
    setSavingTaskId(taskId)
    try {
      const response = await fetch("/api/milestone-task-chapters", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, taskId, chapter }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to save chapter")
      setMessage(chapter ? `Task recorded under Chapter ${chapter}.` : "Task removed from milestone chapters.")
    } catch (error) {
      setAssignments(previous)
      setMessage(error instanceof Error ? error.message : "Unable to save chapter")
    } finally { setSavingTaskId(null) }
  }

  if (!projectId) return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Select a project to view its milestones.</div>
  return <div className="h-full overflow-y-auto pb-8 pr-1"><div className="w-full space-y-5">
    <header><div className="flex gap-1 text-sm text-muted-foreground"><span>Project /</span><span className="text-foreground">{projectName}</span></div><h1 className="mt-1 font-display text-xl font-semibold">Milestones</h1><p className="mt-1 text-sm text-muted-foreground">Organize Board tasks per thesis chapter and monitor chapter completion.</p></header>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-blue-500/10 via-transparent to-transparent p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-primary-fixed)] text-white"><Layers3 className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-fixed)]">Thesis chapters</p><h2 className="font-display text-base font-semibold">Overall chapter progress</h2><p className="text-xs text-muted-foreground">{completedTasks} of {assignedTasks.length} recorded tasks completed</p></div></div><div className="min-w-52"><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Project completion</span><b>{overallProgress}%</b></div><Progress value={overallProgress} className="h-2" /></div></div>
      <div className="overflow-x-auto p-5"><div className="relative flex min-w-[780px] items-start justify-between"><div className="absolute left-10 right-10 top-5 h-px bg-border" />{chapters.map(([number, title]) => { const chapterTasks = tasks.filter((task) => assignmentMap.get(task.id) === number); const done = chapterTasks.length > 0 && chapterTasks.every(isComplete); return <button key={number} onClick={() => setSelectedChapter(number)} className="group relative z-10 flex w-36 flex-col items-center text-center"><span className={cn("flex h-10 w-10 items-center justify-center rounded-full border-4 border-card", done ? "bg-emerald-500 text-white" : selectedChapter === number ? "bg-[var(--brand-primary-fixed)] text-white" : "bg-muted text-muted-foreground")}>{done ? <Check className="h-4 w-4" /> : number}</span><b className={cn("mt-2 text-xs", selectedChapter === number && "text-[var(--brand-primary-fixed)]")}>{title}</b><span className="mt-0.5 text-[10px] text-muted-foreground">{chapterTasks.length} task{chapterTasks.length === 1 ? "" : "s"}</span></button> })}</div></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]"><h2 className="font-display font-semibold">Project chapters</h2><p className="mt-1 text-xs text-muted-foreground">Select a chapter to review its Board tasks.</p><div className="mt-4 space-y-2">{chapters.map(([number, title]) => { const chapterTasks = tasks.filter((task) => assignmentMap.get(task.id) === number); const done = chapterTasks.filter(isComplete).length; const progress = chapterTasks.length ? Math.round(done / chapterTasks.length * 100) : 0; return <button key={number} onClick={() => setSelectedChapter(number)} className={cn("flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left", selectedChapter === number && "border-[var(--brand-primary-fixed)] ring-1 ring-blue-500/20")}><span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-500"><BookOpen className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><span className="text-[10px] text-muted-foreground">{chapterTasks.length} tasks · {progress}% complete</span></span></button> })}</div></section>
      <section className="rounded-xl border bg-card dark:border-[#343434] dark:bg-[#1f1f1f]"><div className="border-b p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-fixed)]">Milestone {selected[0]}</p><h2 className="mt-1 font-display text-base font-semibold">{selected[1]}</h2><p className="mt-1 text-xs text-muted-foreground">{selected[2]}</p></div><Badge variant="outline" className="rounded-full">{selectedCompleted}/{selectedTasks.length} completed</Badge></div><Progress value={selectedProgress} className="mt-4 h-2" /></div>
        <div className="p-5"><h3 className="text-xs font-semibold">Tasks recorded in this chapter</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Status and progress are synchronized with the Board.</p><div className="mt-3 space-y-2">{selectedTasks.length ? selectedTasks.map((task) => <TaskRow key={task.id} task={task} chapter={assignmentMap.get(task.id)} canManage={canManage} saving={savingTaskId === task.id} onChange={(value) => changeChapter(task.id, value)} />) : <div className="rounded-lg border border-dashed p-7 text-center text-xs text-muted-foreground">No Board task recorded in this chapter yet.</div>}</div>
        {canManage && <div className="mt-5 border-t pt-4"><h3 className="text-xs font-semibold">Assign Board tasks</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Each task can be recorded under one chapter.</p><div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} chapter={assignmentMap.get(task.id)} canManage saving={savingTaskId === task.id} onChange={(value) => changeChapter(task.id, value)} compact />) : <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">Create tasks on the Board first.</p>}</div></div>}
        {message && <p className="mt-4 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-500">{message}</p>}
        {!canManage && <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">Chapter assignments are managed by the adviser or coordinator.</p>}</div>
      </section>
    </div>
  </div></div>
}

function TaskRow({ task, chapter, canManage, saving, onChange, compact = false }: { task: Task; chapter?: number; canManage: boolean; saving: boolean; onChange: (value: string) => void; compact?: boolean }) {
  return <div className="flex items-center gap-3 rounded-lg border bg-background p-3"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isComplete(task) ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500")}>{isComplete(task) ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p>{!compact && <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="h-3 w-3" />{taskDate(task.dueDate)} · {task.priority} priority</p>}</div>{canManage && <select aria-label={`Chapter for ${task.title}`} disabled={saving} value={chapter ?? ""} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="">Unassigned</option>{chapters.map(([number, title]) => <option key={number} value={number}>{title}</option>)}</select>}</div>
}
