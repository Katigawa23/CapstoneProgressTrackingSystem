"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { hasSeenDashboardBoardInSession } from "@/lib/dashboard-first-open"
import type { DashboardBoardState } from "@/lib/dashboard-board-state"
import type { DashboardProject } from "@/lib/projects"
import type { BacklogApiItem } from "../types"
import { BoardLoadingState } from "./board-loading-state"

export function DashboardBoardPageShell({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
}: {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}) {
  const initialBoardState = React.useMemo<DashboardBoardState>(() => {
    return initialItems.reduce(
      (counts, item) => {
        if (item.parentId) {
          return counts
        }

        if (item.status === "todo") {
          counts.todoCount += 1
        } else if (item.status === "inprogress") {
          counts.inprogressCount += 1
        } else if (item.status === "revision") {
          counts.revisionCount += 1
        } else if (item.status === "completed") {
          counts.completedCount += 1
        }

        return counts
      },
      {
        todoCount: 0,
        inprogressCount: 0,
        revisionCount: 0,
        completedCount: 0,
      }
    )
  }, [initialItems])
  const shouldShowBoardLoading = React.useMemo(
    () => !hasSeenDashboardBoardInSession(initialSelectedProjectId),
    [initialSelectedProjectId]
  )

  const DashboardBoardPageClient = React.useMemo(
    () =>
      dynamic(
        () => import("./page-client").then((module) => module.DashboardBoardPageClient),
        {
          ssr: false,
          loading: () =>
            shouldShowBoardLoading
              ? <BoardLoadingState cardCounts={initialBoardState} />
              : null,
        }
      ),
    [initialBoardState, shouldShowBoardLoading]
  )

  return (
    <DashboardBoardPageClient
      initialProjects={initialProjects}
      initialSelectedProjectId={initialSelectedProjectId}
      initialItems={initialItems}
    />
  )
}
