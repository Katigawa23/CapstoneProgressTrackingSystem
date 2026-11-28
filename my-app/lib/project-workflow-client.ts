"use client"

import { createContext, useEffect, useState } from "react"
import {
  readProjectBoardColumns,
  readProjectTaskTransitions,
  type ProjectBoardColumn,
  type TaskTransition,
} from "@/lib/task-status-transitions"

type ProjectWorkflow = { transitions: TaskTransition[]; boardColumns: ProjectBoardColumn[]; requiresChapter: boolean }
export const ProjectWorkflowContext = createContext<ProjectWorkflow | undefined>(undefined)
export const projectWorkflowUpdated = "tracksphere:project-workflow-updated"

export function useProjectWorkflow(projectId: string | null) {
  const [loaded, setLoaded] = useState<{ projectId: string; workflow?: ProjectWorkflow; failed?: boolean }>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!projectId) return
    const id = projectId
    let controller: AbortController | undefined
    async function load() {
      controller?.abort()
      const request = new AbortController()
      controller = request
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(id)}/workflow`, {
          cache: "no-store",
          signal: request.signal,
        })
        if (!response.ok) throw new Error("Could not load project workflow")
        const data = await response.json()
        const boardColumns = readProjectBoardColumns(data.workflow?.boardColumns)
        const transitions = boardColumns && readProjectTaskTransitions(data.workflow?.transitions, boardColumns)
        if (!transitions || !boardColumns) throw new Error("Invalid project workflow")
        if (!request.signal.aborted) {
          setLoaded({ projectId: id, workflow: { transitions, boardColumns, requiresChapter: data.workflow.requiresChapter !== false } })
        }
      } catch {
        if (!request.signal.aborted) {
          setLoaded((current) => current?.projectId === id && current.workflow ? current : { projectId: id, failed: true })
        }
      }
    }
    void load()
    window.addEventListener("focus", load)
    window.addEventListener(projectWorkflowUpdated, load)
    return () => {
      controller?.abort()
      window.removeEventListener("focus", load)
      window.removeEventListener(projectWorkflowUpdated, load)
    }
  }, [projectId, attempt])

  const current = loaded?.projectId === projectId ? loaded : undefined
  return {
    workflow: current?.workflow,
    isLoading: Boolean(projectId && !current),
    failed: current?.failed === true,
    retry: () => {
      setLoaded(undefined)
      setAttempt((value) => value + 1)
    },
  }
}
