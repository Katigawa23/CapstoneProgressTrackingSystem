"use client"

import dynamic from "next/dynamic"

import type { DashboardProject } from "@/lib/projects"
import type { BacklogApiItem } from "../types"
import type { SprintRow } from "@backend/repositories/sprint-repository"

const DashboardBoardPageClient = dynamic(
  () => import("./page-client").then((module) => module.DashboardBoardPageClient),
  {
    ssr: false,
  }
)

export function DashboardBoardPageShell({
  initialProjects,
  initialSelectedProjectId,
  initialItems,
  initialSprints,
}: {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
  initialSprints: SprintRow[]
}) {
  return (
    <DashboardBoardPageClient
      initialProjects={initialProjects}
      initialSelectedProjectId={initialSelectedProjectId}
      initialItems={initialItems}
      initialSprints={initialSprints}
    />
  )
}
