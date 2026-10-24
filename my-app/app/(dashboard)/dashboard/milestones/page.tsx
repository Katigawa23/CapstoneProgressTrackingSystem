"use client"

import * as React from "react"
import { BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Download, FileArchive, FileImage, FileText, FolderCheck, Paperclip, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getSelectedDashboardProjectId, PROJECT_CHANGE_EVENT } from "@/lib/projects"

type EvidenceFile = { id: string; name: string; type: "document" | "pdf" | "image" | "archive"; mimeType: string; size: number; uploadedBy: string; uploadedAt: string; downloadUrl: string }
type CompletedTask = { id: string; title: string; chapter: number; assignee: string; completedAt: string; files: EvidenceFile[] }
const chapters = [
  { number: 1, title: "Chapter 1", subtitle: "Introduction and project background" },
  { number: 2, title: "Chapter 2", subtitle: "Review of related literature and systems" },
  { number: 3, title: "Chapter 3", subtitle: "Methodology, requirements, and design" },
  { number: 4, title: "Chapter 4", subtitle: "Development, testing, and results" },
  { number: 5, title: "Chapter 5", subtitle: "Summary, conclusions, and recommendations" },
]
const fileIcons = { document: FileText, pdf: FileText, image: FileImage, archive: FileArchive }
const fileColors = { document: "bg-blue-500/10 text-blue-500", pdf: "bg-red-500/10 text-red-500", image: "bg-emerald-500/10 text-emerald-500", archive: "bg-violet-500/10 text-violet-500" }
const formatDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) }
const formatSize = (bytes: number) => bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function MilestonesPage() {
  const [selectedChapter, setSelectedChapter] = React.useState(1)
  const [completedTasks, setCompletedTasks] = React.useState<CompletedTask[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    async function loadMilestones() {
      const projectId = getSelectedDashboardProjectId()
      if (!projectId) { setCompletedTasks([]); setLoading(false); return }
      setLoading(true); setError("")
      try {
        const response = await fetch(`/api/milestones?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
        const data = await response.json() as { tasks?: CompletedTask[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Failed to load milestones")
        if (!cancelled) setCompletedTasks(data.tasks ?? [])
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
  const chapterFiles = chapterTasks.reduce((total, task) => total + task.files.length, 0)
  const totalFiles = completedTasks.reduce((total, task) => total + task.files.length, 0)

  return <div className="h-full overflow-y-auto pb-8 pr-1"><div className="w-full space-y-5">
    <header><h1 className="font-display text-xl font-semibold">Milestones</h1><p className="mt-1 text-sm text-muted-foreground">Completed tasks and their uploaded files, organized by thesis chapter.</p></header>
    {error && <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
    <section className="overflow-hidden rounded-xl border bg-card dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-blue-500/10 via-transparent to-transparent p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-primary-fixed)] text-white"><FolderCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-fixed)]">Project documentation</p><h2 className="font-display text-base font-semibold">Chapter accomplishment files</h2><p className="text-xs text-muted-foreground">{completedTasks.length} completed tasks · {totalFiles} uploaded files recorded</p></div></div><div className="flex gap-5 text-center"><div><p className="text-xl font-bold text-emerald-500">{completedTasks.length}</p><p className="text-[10px] text-muted-foreground">Completed</p></div><div><p className="text-xl font-bold text-blue-500">{totalFiles}</p><p className="text-[10px] text-muted-foreground">Files</p></div></div></div>
      <div className="overflow-x-auto p-5"><div className="relative flex min-w-[780px] items-start justify-between"><div className="absolute left-10 right-10 top-5 h-px bg-border" />{chapters.map((chapter) => { const tasks = completedTasks.filter((task) => task.chapter === chapter.number); const active = selectedChapter === chapter.number; return <button key={chapter.number} onClick={() => setSelectedChapter(chapter.number)} className="group relative z-10 flex w-36 flex-col items-center text-center"><span className={cn("flex h-10 w-10 items-center justify-center rounded-full border-4 border-card", tasks.length ? "bg-emerald-500 text-white" : active ? "bg-[var(--brand-primary-fixed)] text-white" : "bg-muted text-muted-foreground")}>{tasks.length ? <Check className="h-4 w-4" /> : chapter.number}</span><b className={cn("mt-2 text-xs", active && "text-[var(--brand-primary-fixed)]")}>{chapter.title}</b><span className="mt-0.5 text-[10px] text-muted-foreground">{tasks.length} completed</span></button>})}</div></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="rounded-xl border bg-card p-5 dark:border-[#343434] dark:bg-[#1f1f1f]"><h2 className="font-display font-semibold">Document chapters</h2><p className="mt-1 text-xs text-muted-foreground">Select a chapter to view its completed outputs.</p><div className="mt-4 space-y-2">{chapters.map((chapter) => { const tasks = completedTasks.filter((task) => task.chapter === chapter.number); const files = tasks.reduce((total, task) => total + task.files.length, 0); return <button key={chapter.number} onClick={() => setSelectedChapter(chapter.number)} className={cn("flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left hover:border-blue-500/40", selectedChapter === chapter.number && "border-[var(--brand-primary-fixed)] ring-1 ring-blue-500/20")}><span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-500"><BookOpen className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block text-sm">{chapter.title}</b><span className="text-[10px] text-muted-foreground">{tasks.length} tasks · {files} files</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>})}</div></section>
      <section className="rounded-xl border bg-card dark:border-[#343434] dark:bg-[#1f1f1f]"><div className="border-b p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-fixed)]">Milestone {selected.number}</p><h2 className="mt-1 font-display text-base font-semibold">{selected.title}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.subtitle}</p></div><div className="flex gap-2"><Badge variant="outline" className="gap-1 rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-3 w-3" />{chapterTasks.length} tasks</Badge><Badge variant="outline" className="gap-1 rounded-full"><Paperclip className="h-3 w-3" />{chapterFiles} files</Badge></div></div></div>
        <div className="p-5">{loading ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Loading completed tasks...</div> : chapterTasks.length ? <div className="space-y-4">{chapterTasks.map((task) => <CompletedTaskCard key={task.id} task={task} />)}</div> : <div className="rounded-lg border border-dashed p-10 text-center"><FolderCheck className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No completed task files yet</p><p className="mt-1 text-xs text-muted-foreground">Complete a task assigned to this chapter to record it here.</p></div>}</div>
      </section>
    </div>
  </div></div>
}

function CompletedTaskCard({ task }: { task: CompletedTask }) {
  return <article className="overflow-hidden rounded-xl border bg-background"><div className="flex gap-3 border-b p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-[9px] text-emerald-500">Completed</Badge></div><h3 className="mt-1.5 text-sm font-semibold">{task.title}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{task.assignee}</span><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Completed {formatDate(task.completedAt)}</span></div></div></div><div className="p-4"><div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold">Uploaded files</h4><span className="text-[10px] text-muted-foreground">{task.files.length} attachment{task.files.length === 1 ? "" : "s"}</span></div>{task.files.length ? <div className="grid gap-2 md:grid-cols-2">{task.files.map((file) => { const Icon = fileIcons[file.type]; return <div key={file.id} className="group flex items-center gap-3 rounded-lg border p-3 hover:border-blue-500/35"><span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", fileColors[file.type])}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" title={file.name}>{file.name}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{formatSize(file.size)} · {file.uploadedBy}</p><p className="text-[9px] text-muted-foreground">Uploaded {formatDate(file.uploadedAt)}</p></div><a href={file.downloadUrl} aria-label={`Download ${file.name}`} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Download className="h-3.5 w-3.5" /></a></div>})}</div> : <div className="rounded-md border border-dashed p-4 text-center text-[11px] text-muted-foreground">No files were uploaded to this completed task.</div>}</div></article>
}
