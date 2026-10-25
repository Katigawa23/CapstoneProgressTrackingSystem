"use client"

import * as React from "react"
import Link from "next/link"
import { Check, GraduationCap, Layers3, Loader2, Pencil, Plus, School, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ApiCategory = "program" | "year_level" | "group_type" | "sy_term"
type CategoryKey = "programs" | "yearLevels" | "groupTypes" | "terms"
type ConfigOption = { id: string; category: ApiCategory; label: string; displayOrder: number }
type OptionState = Record<CategoryKey, ConfigOption[]>

const emptyOptions = (): OptionState => ({ programs: [], yearLevels: [], groupTypes: [], terms: [] })
const categoryApiMap: Record<CategoryKey, ApiCategory> = {
  programs: "program", yearLevels: "year_level", groupTypes: "group_type", terms: "sy_term",
}
const categoryDetails: Array<{ key: CategoryKey; title: string; description: string; placeholder: string; icon: React.ElementType }> = [
  { key: "programs", title: "Programs", description: "Academic programs available when creating a group.", placeholder: "Add a program", icon: School },
  { key: "yearLevels", title: "Year levels", description: "Student year levels shown in the group form.", placeholder: "Add a year level", icon: GraduationCap },
  { key: "groupTypes", title: "Group types", description: "Capstone, thesis, and other project classifications.", placeholder: "Add a group type", icon: Layers3 },
  { key: "terms", title: "SY terms", description: "Academic terms available for new groups.", placeholder: "Add an SY term", icon: GraduationCap },
]

function groupOptions(items: ConfigOption[]) {
  const grouped = emptyOptions()
  for (const item of items) {
    const key = (Object.keys(categoryApiMap) as CategoryKey[]).find((candidate) => categoryApiMap[candidate] === item.category)
    if (key) grouped[key].push(item)
  }
  return grouped
}

async function readResponse(response: Response) {
  const payload = (await response.json()) as { option?: ConfigOption; options?: ConfigOption[]; error?: string }
  if (!response.ok) throw new Error(payload.error || "The configuration could not be saved.")
  return payload
}

export function SystemConfigurationPreview() {
  const [options, setOptions] = React.useState<OptionState>(emptyOptions)
  const [drafts, setDrafts] = React.useState<Record<CategoryKey, string>>({ programs: "", yearLevels: "", groupTypes: "", terms: "" })
  const [editing, setEditing] = React.useState<{ category: CategoryKey; id: string } | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<{ category: CategoryKey; option: ConfigOption } | null>(null)
  const [pendingAdd, setPendingAdd] = React.useState<{ category: CategoryKey; label: string } | null>(null)
  const [pendingEdit, setPendingEdit] = React.useState<{ category: CategoryKey; id: string; oldLabel: string; newLabel: string } | null>(null)

  React.useEffect(() => {
    let active = true
    void fetch("/api/project-configuration", { cache: "no-store" }).then(readResponse).then((payload) => {
      if (active) setOptions(groupOptions(payload.options ?? []))
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load configuration options.")
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const requestAddOption = (category: CategoryKey) => {
    const label = drafts[category].trim()
    if (!label || saving) return
    if (options[category].some((item) => item.label.toLowerCase() === label.toLowerCase())) return setError("This option already exists.")
    setError(null)
    setPendingAdd({ category, label })
  }

  const addOption = async () => {
    if (!pendingAdd || saving) return
    const { category, label } = pendingAdd
    setSaving(true); setError(null)
    try {
      const payload = await readResponse(await fetch("/api/project-configuration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: categoryApiMap[category], label }) }))
      if (payload.option) setOptions((current) => ({ ...current, [category]: [...current[category], payload.option!] }))
      setDrafts((current) => ({ ...current, [category]: "" }))
      setPendingAdd(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to add option.") }
    finally { setSaving(false) }
  }

  const deleteOption = async () => {
    if (saving || !pendingDelete) return
    const { category, option } = pendingDelete
    setSaving(true); setError(null)
    try {
      await readResponse(await fetch(`/api/project-configuration?id=${encodeURIComponent(option.id)}`, { method: "DELETE" }))
      setOptions((current) => ({ ...current, [category]: current[category].filter((item) => item.id !== option.id) }))
      if (editing?.id === option.id) setEditing(null)
      setPendingDelete(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to delete option.") }
    finally { setSaving(false) }
  }

  const requestSaveEdit = () => {
    const label = editValue.trim()
    if (!editing || !label || saving) return
    const currentOption = options[editing.category].find((item) => item.id === editing.id)
    if (!currentOption) return
    if (currentOption.label === label) {
      setEditing(null); setEditValue("")
      return
    }
    if (options[editing.category].some((item) => item.id !== editing.id && item.label.toLowerCase() === label.toLowerCase())) return setError("This option already exists.")
    setError(null)
    setPendingEdit({ category: editing.category, id: editing.id, oldLabel: currentOption.label, newLabel: label })
  }

  const saveEdit = async () => {
    if (!pendingEdit || saving) return
    const { category, id, newLabel } = pendingEdit
    setSaving(true); setError(null)
    try {
      const payload = await readResponse(await fetch("/api/project-configuration", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, label: newLabel }) }))
      if (payload.option) {
        const updated = payload.option
        setOptions((current) => ({ ...current, [category]: current[category].map((item) => item.id === updated.id ? updated : item) }))
      }
      setEditing(null); setEditValue(""); setPendingEdit(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to update option.") }
    finally { setSaving(false) }
  }

  return <><div className="h-full overflow-y-auto pb-8 pr-1"><div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-[#343434]">
      <div className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-[var(--brand-primary-fixed)] hover:underline">Project</Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">System Configuration</span>
      </div>
      <div><h1 className="font-display text-2xl font-semibold tracking-tight">System Configuration</h1><p className="mt-1 text-sm text-muted-foreground">Manage the choices displayed in the Create Group form.</p></div>
    </div>
    {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
    {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Loading configuration...</div> :
    <div className="grid items-start gap-4 lg:grid-cols-2">{categoryDetails.map((category) => {
      const Icon = category.icon
      return <section key={category.key} className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
        <div className="flex items-start gap-3 border-b p-4 dark:border-[#343434]"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color:rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary-fixed)]"><Icon className="size-5" /></div><div><h2 className="font-display text-base font-semibold">{category.title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p></div></div>
        <div className="space-y-3 p-4"><div className="flex gap-2"><Input value={drafts[category.key]} disabled={saving} onChange={(event) => setDrafts((current) => ({ ...current, [category.key]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") requestAddOption(category.key) }} placeholder={category.placeholder} className="h-9" /><Button type="button" size="sm" disabled={saving || !drafts[category.key].trim()} className="h-9 gap-1.5" onClick={() => requestAddOption(category.key)}><Plus className="size-4" /> Add</Button></div>
          <div className="max-h-[204px] space-y-2 overflow-y-auto pr-1">{options[category.key].map((option) => {
            const isEditing = editing?.category === category.key && editing.id === option.id
            return <div key={option.id} className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 py-2 dark:border-[#343434]">
              {isEditing ? <Input autoFocus disabled={saving} value={editValue} onChange={(event) => setEditValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") requestSaveEdit(); if (event.key === "Escape") setEditing(null) }} className="h-8 flex-1" /> : <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>}
              {isEditing ? <><button disabled={saving} type="button" className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-500/10" onClick={requestSaveEdit} aria-label={`Save ${option.label}`}><Check className="size-4" /></button><button disabled={saving} type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setEditing(null)} aria-label="Cancel editing"><X className="size-4" /></button></> : <><button disabled={saving} type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { setEditing({ category: category.key, id: option.id }); setEditValue(option.label) }} aria-label={`Edit ${option.label}`}><Pencil className="size-4" /></button><button disabled={saving} type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500" onClick={() => setPendingDelete({ category: category.key, option })} aria-label={`Delete ${option.label}`}><Trash2 className="size-4" /></button></>}
            </div>
          })}{options[category.key].length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">No options added yet.</div> : null}</div>
        </div>
      </section>
    })}</div>}
  </div></div>
    <AlertDialog open={Boolean(pendingAdd)} onOpenChange={(open) => { if (!open && !saving) setPendingAdd(null) }}>
      <AlertDialogContent className="max-w-md rounded-xl border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Add configuration option?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
            Add <span className="font-medium text-slate-900 dark:text-slate-100">{pendingAdd?.label}</span> under {pendingAdd ? categoryDetails.find((item) => item.key === pendingAdd.category)?.title : "this category"}? It will become available in the Coordinator Create Group form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void addOption() }}>
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Adding...</> : <><Plus className="mr-2 size-4" />Add option</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(pendingEdit)} onOpenChange={(open) => { if (!open && !saving) setPendingEdit(null) }}>
      <AlertDialogContent className="max-w-md rounded-xl border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Save configuration changes?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-slate-600 dark:text-slate-300">
              <p>This change will appear in the Coordinator Create Group form.</p>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm dark:border-[#343434] dark:bg-[#171717]">
                <p><span className="text-muted-foreground">Current:</span> <span className="font-medium text-slate-900 dark:text-slate-100">{pendingEdit?.oldLabel}</span></p>
                <p className="mt-1"><span className="text-muted-foreground">New:</span> <span className="font-medium text-[var(--brand-primary-fixed)]">{pendingEdit?.newLabel}</span></p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void saveEdit() }}>
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving...</> : <><Check className="mr-2 size-4" />Save changes</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !saving) setPendingDelete(null) }}>
      <AlertDialogContent className="max-w-md rounded-xl border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete configuration option?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-900 dark:text-slate-100">{pendingDelete?.option.label}</span> will be removed from the Coordinator Create Group form. Existing groups will not be changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={(event) => { event.preventDefault(); void deleteOption() }} className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600">
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Deleting...</> : <><Trash2 className="mr-2 size-4" />Delete</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
