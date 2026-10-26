"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Search, ShieldCheck, UserRoundCheck, UserRoundPlus, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Assignment = { programId: string; programLabel: string; facultyUserId: string | null; facultyName: string | null; facultyEmail: string | null; assignedAt: string | null }
type Faculty = { id: string; name: string; email: string; role: string }

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || "Request failed.")
  return payload
}

export function CoordinatorManagement() {
  const [assignments, setAssignments] = React.useState<Assignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeProgram, setActiveProgram] = React.useState<Assignment | null>(null)
  const [removeProgram, setRemoveProgram] = React.useState<Assignment | null>(null)
  const [query, setQuery] = React.useState("")
  const [faculty, setFaculty] = React.useState<Faculty[]>([])
  const [facultyLoading, setFacultyLoading] = React.useState(false)
  const [selectedFaculty, setSelectedFaculty] = React.useState<Faculty | null>(null)
  const [changeConfirmOpen, setChangeConfirmOpen] = React.useState(false)
  const assignedFacultyIds = React.useMemo(
    () => new Set(assignments.filter((item) => item.facultyUserId && item.programId !== activeProgram?.programId).map((item) => item.facultyUserId as string)),
    [assignments, activeProgram?.programId]
  )
  const availableFaculty = React.useMemo(
    () => faculty.filter((user) => !assignedFacultyIds.has(user.id)),
    [faculty, assignedFacultyIds]
  )

  const loadAssignments = React.useCallback(async () => {
    try {
      const payload = await responseJson<{ assignments: Assignment[] }>(await fetch("/api/coordinator-assignments", { cache: "no-store" }))
      setAssignments(payload.assignments)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to load assignments.") }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { void loadAssignments() }, [loadAssignments])
  React.useEffect(() => {
    if (!activeProgram) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setFacultyLoading(true)
      void fetch(`/api/registered-users?role=faculty&q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" })
        .then((response) => responseJson<{ users: Faculty[] }>(response))
        .then((payload) => setFaculty(payload.users))
        .catch((cause: unknown) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Failed to load faculty.") })
        .finally(() => setFacultyLoading(false))
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProgram, query])

  const openAssignment = (assignment: Assignment) => {
    setActiveProgram(assignment); setQuery(""); setSelectedFaculty(null); setError(null)
  }
  const saveAssignment = async () => {
    if (!activeProgram || !selectedFaculty || saving) return
    setSaving(true); setError(null)
    try {
      await responseJson(await fetch("/api/coordinator-assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programId: activeProgram.programId, facultyUserId: selectedFaculty.id }) }))
      setChangeConfirmOpen(false); setActiveProgram(null); setSelectedFaculty(null); await loadAssignments()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to assign coordinator.") }
    finally { setSaving(false) }
  }
  const requestSaveAssignment = () => {
    if (!activeProgram || !selectedFaculty) return
    if (activeProgram.facultyUserId && activeProgram.facultyUserId !== selectedFaculty.id) {
      setChangeConfirmOpen(true)
      return
    }
    void saveAssignment()
  }
  const confirmRemove = async () => {
    if (!removeProgram || saving) return
    setSaving(true); setError(null)
    try {
      await responseJson(await fetch(`/api/coordinator-assignments?programId=${encodeURIComponent(removeProgram.programId)}`, { method: "DELETE" }))
      setRemoveProgram(null); await loadAssignments()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to remove coordinator.") }
    finally { setSaving(false) }
  }

  return <>
    <div className="h-full overflow-y-auto pb-8 pr-1"><div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-5 dark:border-[#343434]">
        <div className="mb-3 flex items-center gap-1.5 text-sm"><Link href="/dashboard" className="text-muted-foreground hover:text-[var(--brand-primary-fixed)] hover:underline">Project</Link><span className="text-muted-foreground">/</span><span className="font-medium">Coordinator Management</span></div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Coordinator Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assign one registered faculty coordinator to each academic program.</p>
      </header>
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
      {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading programs...</div> :
        <div className="grid gap-4 md:grid-cols-2">{assignments.map((item) => <section key={item.programId} className="rounded-xl border bg-card p-5 shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-[var(--brand-primary-fixed)]">Academic program</p><h2 className="mt-1 text-lg font-semibold">{item.programLabel}</h2></div><ShieldCheck className="size-5 text-muted-foreground" /></div>
          <div className="mt-5 rounded-lg border bg-background p-4 dark:border-[#343434]">
            {item.facultyUserId ? <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-primary-fixed)] text-sm font-semibold text-white">{item.facultyName?.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase() || "FC"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.facultyName}</p><p className="truncate text-xs text-muted-foreground">{item.facultyEmail}</p></div></div> : <div className="flex items-center gap-3 text-muted-foreground"><UserRoundCheck className="size-9 rounded-full border p-2" /><div><p className="text-sm font-medium text-foreground">No coordinator assigned</p><p className="text-xs">Select a registered faculty account.</p></div></div>}
          </div>
          <div className="mt-4 flex justify-end gap-2">{item.facultyUserId ? <Button variant="outline" size="sm" onClick={() => setRemoveProgram(item)} className="gap-2 text-red-500"><UserX className="size-4" />Remove</Button> : null}<Button size="sm" onClick={() => openAssignment(item)} className="gap-2"><UserRoundPlus className="size-4" />{item.facultyUserId ? "Change" : "Assign"}</Button></div>
        </section>)}{assignments.length === 0 ? <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No programs configured. Add a program in System Configuration first.</div> : null}</div>}
    </div></div>

    <Dialog open={Boolean(activeProgram)} onOpenChange={(open) => { if (!open && !saving && !changeConfirmOpen) setActiveProgram(null) }}><DialogContent className="max-w-lg dark:border-[#343434] dark:bg-[#1f1f1f]"><DialogHeader><DialogTitle>{activeProgram?.facultyUserId ? "Change coordinator" : "Assign coordinator"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Program: <span className="font-medium text-foreground">{activeProgram?.programLabel}</span></p><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search registered faculty" className="pl-9" /></div><div className="max-h-64 space-y-2 overflow-y-auto pr-1">{facultyLoading ? <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin" /></div> : availableFaculty.map((user) => <button type="button" key={user.id} onClick={() => setSelectedFaculty(user)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selectedFaculty?.id === user.id ? "border-[var(--brand-primary-fixed)] bg-[color:rgba(var(--brand-primary-rgb),0.08)]" : "dark:border-[#343434]"}`}><div className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-primary-fixed)] text-xs font-semibold text-white">{user.name.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></button>)}{!facultyLoading && availableFaculty.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No available faculty found. Faculty already assigned to another program cannot be selected.</p> : null}</div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setActiveProgram(null)}>Cancel</Button><Button disabled={!selectedFaculty || saving || selectedFaculty.id === activeProgram?.facultyUserId} onClick={requestSaveAssignment}>{saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : activeProgram?.facultyUserId ? "Continue" : "Assign coordinator"}</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={changeConfirmOpen} onOpenChange={(open) => { if (!saving) setChangeConfirmOpen(open) }}><AlertDialogContent className="dark:border-[#343434] dark:bg-[#1f1f1f]"><AlertDialogHeader><AlertDialogTitle>Change assigned coordinator?</AlertDialogTitle><AlertDialogDescription asChild><div className="space-y-3"><p>The coordinator for <span className="font-medium text-foreground">{activeProgram?.programLabel}</span> will be changed.</p><div className="rounded-lg border bg-muted/30 p-3 text-sm dark:border-[#343434]"><p><span className="text-muted-foreground">Current:</span> <span className="font-medium text-foreground">{activeProgram?.facultyName}</span></p><p className="mt-1"><span className="text-muted-foreground">New:</span> <span className="font-medium text-[var(--brand-primary-fixed)]">{selectedFaculty?.name}</span></p></div></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Keep current</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void saveAssignment() }}>{saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : "Confirm change"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <AlertDialog open={Boolean(removeProgram)} onOpenChange={(open) => { if (!open && !saving) setRemoveProgram(null) }}><AlertDialogContent className="dark:border-[#343434] dark:bg-[#1f1f1f]"><AlertDialogHeader><AlertDialogTitle>Remove coordinator?</AlertDialogTitle><AlertDialogDescription>{removeProgram?.facultyName} will no longer be the coordinator of {removeProgram?.programLabel}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void confirmRemove() }} className="bg-red-600 text-white hover:bg-red-700">{saving ? "Removing..." : "Remove coordinator"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
