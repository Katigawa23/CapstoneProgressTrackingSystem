"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { projectWorkflowUpdated } from "@/lib/project-workflow-client"
import { createWorkflowFromPreset, projectWorkflowPresets, type ProjectWorkflowPreset } from "@/lib/project-workflow-presets"
import {
  isCustomTaskStatus,
  legacyTaskTransitions,
  maxCustomTaskStatuses,
  maxProjectWipLimit,
  readProjectTaskTransitions,
  taskStatuses,
  type CustomTaskStatus,
  type ProjectBoardColumn,
  type TaskTransition,
  type TaskStatus,
} from "@/lib/task-status-transitions"

type Workflow = { revision: number; transitions: TaskTransition[]; boardColumns: ProjectBoardColumn[]; requiresChapter: boolean }

const labels: Record<TaskStatus, string> = {
  todo: "To-do",
  inprogress: "In Progress",
  inreview: "In Review",
  revision: "Revision",
  completed: "Completed",
}

export function ProjectWorkflowSettings({ projectId }: { projectId: string }) {
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/workflow`
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [transitions, setTransitions] = useState<TaskTransition[]>([])
  const [boardColumns, setBoardColumns] = useState<ProjectBoardColumn[]>([])
  const [requiresChapter, setRequiresChapter] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [preset, setPreset] = useState<Exclude<ProjectWorkflowPreset, "existing">>("kanban")
  const [from, setFrom] = useState<TaskTransition["from"]>("inprogress")
  const [to, setTo] = useState<TaskTransition["to"]>("completed")

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
        if (!response.ok) throw new Error("Could not load workflow settings.")
        const data = await response.json() as { workflow: Workflow; canEdit: boolean }
        if (!controller.signal.aborted && data.canEdit) {
          setWorkflow(data.workflow)
          setTransitions(data.workflow.transitions)
          setBoardColumns(data.workflow.boardColumns)
          setRequiresChapter(data.workflow.requiresChapter)
        }
      } catch {
        if (!controller.signal.aborted) setMessage("Could not load workflow settings.")
      }
    }
    void load()
    return () => controller.abort()
  }, [endpoint])

  async function save() {
    if (!workflow || saving) return
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: workflow.revision, transitions, boardColumns, requiresChapter }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not save workflow.")
      setWorkflow(data.workflow)
      setTransitions(data.workflow.transitions)
      setBoardColumns(data.workflow.boardColumns)
      setRequiresChapter(data.workflow.requiresChapter)
      setMessage("Workflow saved.")
      window.dispatchEvent(new Event(projectWorkflowUpdated))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save workflow.")
    } finally {
      setSaving(false)
    }
  }

  function moveColumn(index: number, direction: -1 | 1) {
    setBoardColumns((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [column] = next.splice(index, 1)
      next.splice(target, 0, column)
      return next
    })
  }

  const customColumns = boardColumns.filter((column) => isCustomTaskStatus(column.id))
  const statusIds = [...taskStatuses, ...customColumns.map((column) => column.id)]
  const labelFor = (status: TaskTransition["from"]) =>
    boardColumns.find((column) => column.id === status)?.label ||
    (isCustomTaskStatus(status) ? "Custom status" : labels[status])
  const customRule: TaskTransition = { from, to, role: "faculty" }
  const canAddRule = (isCustomTaskStatus(from) || isCustomTaskStatus(to)) &&
    Boolean(readProjectTaskTransitions([...transitions, customRule], boardColumns))

  function addStatus() {
    const id: CustomTaskStatus = `custom-${crypto.randomUUID()}`
    setBoardColumns((current) => {
      const completedIndex = current.findIndex((column) => column.id === "completed")
      const next = [...current]
      next.splice(completedIndex, 0, { id, label: "New status" })
      return next
    })
    setTransitions((current) => [...current, { from: id, to: "inprogress", role: "faculty" }])
    setTo(id)
  }

  return workflow ? (
    <details className="rounded-md border p-4">
      <summary className="cursor-pointer text-sm font-medium">Workflow settings</summary>
      <fieldset disabled={saving} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">Workflow preset
          <select className="rounded-md border bg-background p-1" value={preset}
            onChange={(event) => setPreset(event.target.value as typeof preset)}>
            <option value="kanban">{projectWorkflowPresets.kanban.label}</option>
            <option value="qa">{projectWorkflowPresets.qa.label}</option>
            <option value="academic">{projectWorkflowPresets.academic.label}</option>
          </select>
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          const next = createWorkflowFromPreset(preset, { boardColumns, transitions })
          setBoardColumns(next.boardColumns)
          setTransitions(next.transitions)
          setRequiresChapter(next.requiresChapter)
          setMessage("Preset loaded. Review the changes before saving.")
        }}>Load preset</Button>
      </fieldset>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={saving} checked={requiresChapter}
          onChange={(event) => setRequiresChapter(event.target.checked)} />
        Require a chapter for new tasks
      </label>
      <fieldset disabled={saving} className="mt-3 space-y-2">
        <legend className="text-sm font-medium">Board columns</legend>
        <p className="text-xs text-muted-foreground">A work-in-progress limit blocks moves when the column is full. Leave it blank for unlimited moves.</p>
        {boardColumns.map((column, index) => (
          <div key={column.id} className="flex flex-wrap items-center gap-2">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24">{isCustomTaskStatus(column.id) ? "Custom status" : labels[column.id]}</span>
              <input
                className="rounded-md border bg-background px-2 py-1"
                aria-label={`Label for ${labelFor(column.id)}`}
                placeholder={isCustomTaskStatus(column.id) ? "Status name" : labels[column.id]}
                value={column.label ?? ""}
                maxLength={40}
                onChange={(event) => {
                  const label = event.target.value
                  setBoardColumns((current) => current.map((entry) =>
                    entry.id === column.id ? { ...entry, label: label.trim() || isCustomTaskStatus(entry.id) ? label : null } : entry
                  ))
                }}
              />
            </label>
            {column.id !== "todo" && column.id !== "completed" ? (
              <label className="flex items-center gap-2 text-sm">
                WIP limit
                <input
                  className="w-20 rounded-md border bg-background px-2 py-1"
                  type="number"
                  min={1}
                  max={maxProjectWipLimit}
                  aria-label={`Work-in-progress limit for ${labelFor(column.id)}`}
                  value={column.wipLimit ?? ""}
                  onChange={(event) => {
                    const limit = event.target.value === "" ? undefined : event.target.valueAsNumber
                    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > maxProjectWipLimit)) return
                    setBoardColumns((current) => current.map((entry) =>
                      entry.id === column.id ? { ...entry, wipLimit: limit } : entry
                    ))
                  }}
                />
              </label>
            ) : null}
            <Button type="button" size="sm" variant="outline" disabled={index === 0}
              aria-label={`Move ${labelFor(column.id)} up`} onClick={() => moveColumn(index, -1)}>Up</Button>
            <Button type="button" size="sm" variant="outline" disabled={index === boardColumns.length - 1}
              aria-label={`Move ${labelFor(column.id)} down`} onClick={() => moveColumn(index, 1)}>Down</Button>
            {isCustomTaskStatus(column.id) && !workflow.boardColumns.some((entry) => entry.id === column.id) ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => {
                setBoardColumns((current) => current.filter((entry) => entry.id !== column.id))
                setTransitions((current) => current.filter((rule) => rule.from !== column.id && rule.to !== column.id))
                if (from === column.id) setFrom("inprogress")
                if (to === column.id) setTo("completed")
              }}>Remove</Button>
            ) : null}
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={customColumns.length >= maxCustomTaskStatuses}
          onClick={addStatus}>Add status</Button>
      </fieldset>
      {customColumns.length ? (
        <fieldset disabled={saving} className="mt-3 space-y-2">
          <legend className="text-sm font-medium">Adviser moves involving custom statuses</legend>
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="grid gap-1">From
              <select className="rounded-md border bg-background p-1" value={from}
                onChange={(event) => setFrom(event.target.value as TaskTransition["from"])}>
                {statusIds.filter((status) => status !== "completed").map((status) =>
                  <option key={status} value={status}>{labelFor(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1">To
              <select className="rounded-md border bg-background p-1" value={to}
                onChange={(event) => setTo(event.target.value as TaskTransition["to"])}>
                {statusIds.filter((status) => status !== "inreview").map((status) =>
                  <option key={status} value={status}>{labelFor(status)}</option>)}
              </select>
            </label>
            <Button type="button" size="sm" variant="outline" disabled={!canAddRule}
              onClick={() => setTransitions((current) => [...current, customRule])}>Add move</Button>
          </div>
          {transitions.filter((rule) => isCustomTaskStatus(rule.from) || isCustomTaskStatus(rule.to)).map((rule) => (
            <div className="flex items-center gap-2 text-sm" key={`${rule.from}-${rule.to}`}>
              <span>{labelFor(rule.from)} → {labelFor(rule.to)}</span>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => setTransitions((current) => current.filter((entry) => entry !== rule))}>Remove</Button>
            </div>
          ))}
        </fieldset>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">Choose which status moves this project permits.</p>
      <fieldset disabled={saving} className="mt-3 grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Allowed status moves</legend>
        {legacyTaskTransitions.map((rule) => {
          const matches = (item: TaskTransition) =>
            item.from === rule.from && item.to === rule.to && item.role === rule.role
          return (
            <label key={`${rule.role}-${rule.from}-${rule.to}`} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={transitions.some(matches)} onChange={(event) => {
                const enabled = event.target.checked
                setTransitions((current) => enabled ? [...current, rule] : current.filter((item) => !matches(item)))
              }} />
              {rule.role === "student" ? "Student" : "Adviser"} · {labelFor(rule.from)} → {labelFor(rule.to)}
            </label>
          )
        })}
      </fieldset>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" disabled={saving} onClick={save}>Save workflow</Button>
        <span role="status" className="text-sm">{message}</span>
      </div>
    </details>
  ) : message ? <p role="status" className="text-sm">{message}</p> : null
}
