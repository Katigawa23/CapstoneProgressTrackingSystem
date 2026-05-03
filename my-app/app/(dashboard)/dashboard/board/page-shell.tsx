"use client"

import dynamic from "next/dynamic"

import type { DashboardProject } from "@/lib/projects"
import type { BacklogApiItem } from "../types"

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
}: {
  initialProjects: DashboardProject[]
  initialSelectedProjectId: string | null
  initialItems: BacklogApiItem[]
}) {
  return (
    <DashboardBoardPageClient
      initialProjects={initialProjects}
      initialSelectedProjectId={initialSelectedProjectId}
      initialItems={initialItems}
    />
  )
}
