"use client"

import Link from "next/link"
import * as React from "react"
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, FolderCheck, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getSelectedDashboardProjectId, PROJECT_CHANGE_EVENT } from "@/lib/projects"

type CompletedTask = { id: string; title: string; chapter: number; assignee: string; completedAt: string }
const chapters = [
  { number: 1, title: "Chapter 1", subtitle: "Introduction and project background" },
  { number: 2, title: "Chapter 2", subtitle: "Review of related literature and systems" },
  { number: 3, title: "Chapter 3", subtitle: "Methodology, requirements, and design" },
  { number: 4, title: "Chapter 4", subtitle: "Development, testing, and results" },
  { number: 5, title: "Chapter 5", subtitle: "Summary, conclusions, and recommendations" },
]
const tasksPerPage = 5
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) }

export default function MilestonesPage() {
  const [selectedChapter, setSelectedChapter] = React.useState(1)
  const [loadedProjectId, setLoadedProjectId] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [completedTasks, setCompletedTasks] = React.useState<CompletedTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    async function loadMilestones() {
      setPage(1)
      setLoadedProjectId("")
      const projectId = getSelectedDashboardProjectId()
      if (!projectId) { setCompletedTasks([]); setLoading(false); return }
      setLoading(true); setError("")
      try {
        const response = await fetch(`/api/milestones?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
        const data = await response.json() as { tasks?: CompletedTask[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Failed to load milestones")
        if (!cancelled && projectId === getSelectedDashboardProjectId()) {
          setCompletedTasks(data.tasks ?? [])
          setLoadedProjectId(projectId)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load milestones")
      } finally { if (!cancelled) setLoading(false) }
    }
    void loadMilestones()
    window.addEventListener(PROJECT_CHANGE_EVENT, loadMilestones)
    return () => { cancelled = true; window.removeEventListener(PROJECT_CHANGE_EVENT, loadMilestones) }
  }, [])

  const selected = chapters[selectedChapter - 1]
  const chapterTasks = completedTasks.filter((task) => task.chapter === selectedChapter)
  const pageCount = Math.max(1, Math.ceil(chapterTasks.length / tasksPerPage))
  const currentPage = Math.min(page, pageCount)
  const firstTask = (currentPage - 1) * tasksPerPage
  const visibleTasks = chapterTasks.slice(firstTask, firstTask + tasksPerPage)

  return <div className="h-full overflow-y-auto pb-8 pr-1"><div className="mx-auto w-full max-w-[1440px] space-y-5">
    <header className="flex items-center gap-3 border-b border-border pb-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
        <FolderCheck className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Milestones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open completed tasks by chapter.</p>
      </div>
    </header>
    {error && <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
    <section className="overflow-hidden rounded-xl border bg-card dark:border-[var(--border)] dark:bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold">Chapters</h2>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-emerald-500/10 px-2.5 py-1.5"><strong className="text-foreground">{completedTasks.length}</strong> completed tasks</span>
        </div>
      </div>
      <div aria-label="Choose a chapter" className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5 sm:p-5">
        {chapters.map((chapter) => {
          const active = selectedChapter === chapter.number
          const count = completedTasks.filter((task) => task.chapter === chapter.number).length
          return (
            <button key={chapter.number} type="button" aria-pressed={active}
              onClick={() => { setSelectedChapter(chapter.number); setPage(1) }}
              className={cn("flex min-w-0 flex-col items-start gap-1 rounded-xl border bg-background p-3 text-left transition-colors hover:border-cyan-500/50", active && "border-cyan-600 bg-cyan-500/10 dark:border-cyan-400/60")}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="size-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
                {chapter.title}
              </span>
              <span className="text-xs text-muted-foreground">{count} completed</span>
            </button>
          )
        })}
      </div>
    </section>
      <section className="rounded-xl border bg-card dark:border-[var(--border)] dark:bg-[var(--card)]"><div className="border-b p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="mt-1 font-display text-base font-semibold">{selected.title}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.subtitle}</p></div><div className="flex gap-2"><Badge variant="outline" className="gap-1 rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-3 w-3" />{chapterTasks.length} tasks</Badge></div></div></div>
        <div className="p-3 sm:p-5">
          {loading ? <p className="p-4 text-sm text-muted-foreground">Loading completed tasks…</p> : loadedProjectId && visibleTasks.length ? (
            <>
              <div className="overflow-hidden rounded-lg border bg-background">
                {visibleTasks.map((task) => <CompletedTaskRow key={task.id} task={task} projectId={loadedProjectId} />)}
              </div>
              {pageCount > 1 && (
                <nav aria-label="Completed tasks pages" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span aria-live="polite" className="text-muted-foreground">{firstTask + 1}–{firstTask + visibleTasks.length} of {chapterTasks.length} tasks</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-40">Previous</button>
                    <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-40">Next</button>
                  </div>
                </nav>
              )}
            </>
          ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No completed tasks yet.</p>}
        </div>
      </section>
  </div></div>
}

function CompletedTaskRow({ task, projectId }: { task: CompletedTask; projectId: string }) {
  const query = new URLSearchParams({ projectId, taskId: task.id })
  return (
    <Link href={`/dashboard/board?${query}`} className="flex items-start gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-4">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-semibold">{task.title}</h3>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><UserRound className="size-3.5 shrink-0" />{task.assignee}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0" />{formatDate(task.completedAt)}</span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
