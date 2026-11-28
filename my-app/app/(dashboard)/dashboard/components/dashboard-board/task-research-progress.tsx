"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight, ChevronDown, ClipboardList, Plus } from "lucide-react"

type SurveySummary = { token: string; published: boolean; title: string; closed: boolean }
const countInputClass = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
const actionClass = "h-9 w-9 rounded-[2px] p-0 hover:opacity-90"
const actionStyle = { backgroundColor: "var(--brand-primary-fixed)", color: "var(--brand-primary-fixed-foreground)" }

export function TaskResearchProgress({ taskId, canEdit }: {
  taskId: string
  canEdit: boolean
}) {
  const endpoint = `/api/backlog-items/${encodeURIComponent(taskId)}/research-progress`
  const surveyPath = `/dashboard/surveys/${encodeURIComponent(taskId)}`
  const router = useRouter()
  const [hasTarget, setHasTarget] = useState<boolean>()
  const [target, setTarget] = useState("")
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [surveys, setSurveys] = useState<SurveySummary[]>([])
  const [canAccessSurveys, setCanAccessSurveys] = useState(false)
  const [editing, setEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error("Could not load research progress.")
        const { progress, surveys, canAccessSurveys } = await response.json() as {
          progress: { target: number } | null; surveys?: SurveySummary[]; canAccessSurveys?: boolean
        }
        if (controller.signal.aborted) return
        setHasTarget(Boolean(progress))
        setSurveys(surveys ?? [])
        setCanAccessSurveys(canAccessSurveys === true)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [endpoint, attempt])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || saving || hasTarget !== false) return
    setSaving(true)
    setSaveFailed(false)
    setMessage("")
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: Number(target), completed: 0, revision: null }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Could not save research progress.")
      setHasTarget(true)
      setEditing(false)
      router.push(surveyPath + "?new=1")
    } catch (error) {
      setSaveFailed(true)
      setMessage(error instanceof Error ? error.message : "Could not save research progress.")
    } finally {
      setSaving(false)
    }
  }

  function startEditing() {
    setIsExpanded(true)
    setTarget("")
    setMessage("")
    setSaveFailed(false)
    setEditing(true)
  }

  function reload() {
    setFailed(false)
    setSaveFailed(false)
    setMessage("")
    setHasTarget(undefined)
    setEditing(false)
    setAttempt((value) => value + 1)
  }

  if (!failed && hasTarget !== undefined && (!canAccessSurveys || (!surveys.length && !canEdit))) return null

  return (
    <>
      <Separator className="mt-4 bg-slate-200 dark:bg-[var(--border)]" />
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mt-4 space-y-3">
        <div className="flex w-full items-start justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button type="button"
              className="inline-flex items-center gap-2 text-left text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} survey`}>
              <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
              <span className="text-[15px] font-semibold">Survey</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[var(--border)] dark:text-slate-300">
                {surveys.length}
              </span>
            </button>
          </CollapsibleTrigger>
          <div className="mt-0.5 flex items-center gap-2">
            {!failed && canAccessSurveys && canEdit ? (
              hasTarget ? <Button asChild size="sm" className={actionClass} style={actionStyle}>
                <Link href={surveyPath + "?new=1"} prefetch={false} aria-label="Create survey" title="Create survey">
                  <Plus aria-hidden className="h-4 w-4" />
                </Link>
              </Button> : <Button type="button" size="sm" className={actionClass} style={actionStyle}
                aria-label="Create survey" title="Create survey" disabled={saving || hasTarget === undefined}
                onClick={() => editing ? setIsExpanded(true) : startEditing()}>
                <Plus aria-hidden className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <CollapsibleContent className="space-y-3 pl-6">
          {hasTarget ? surveys.map((survey) => (
            <Link key={survey.token} href={surveyPath + "?survey=" + encodeURIComponent(survey.token)}
              className="flex min-w-0 items-center gap-2.5 rounded-[2px] border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors hover:bg-slate-50 dark:border-[var(--border)] dark:bg-[var(--card)] dark:hover:bg-[#2c2c2c]">
              <ClipboardList aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 break-words font-medium">{survey.title?.trim() || "Untitled survey"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{survey.closed ? "Closed" : survey.published ? "Published" : "Draft"}</span>
              <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )) : null}
          {hasTarget === undefined && !failed ? <p role="status" className="text-sm text-muted-foreground">Loading survey…</p> : null}
          {failed ? <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-xs">Could not load research progress.</p>
            <Button type="button" size="sm" variant="outline" onClick={reload}>Retry</Button>
          </div> : canEdit && editing && hasTarget === false ? (
            <form onSubmit={save} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">Target responses
                  <Input className={countInputClass} type="number" min={1} max={1000000} step={1} required value={target} onChange={(event) => setTarget(event.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Continue to survey"}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => {
                  setEditing(false)
                  setMessage("")
                }}>Cancel</Button>
                {saveFailed ? <Button type="button" size="sm" variant="ghost" onClick={reload}>Reload count</Button> : null}
                {message ? <p role={saveFailed ? "alert" : "status"} className="text-xs">{message}</p> : null}
              </div>
            </form>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
