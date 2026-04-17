import { getSelectedProjectData } from "../data"
import { DashboardBoardPageClient } from "./page-client"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function DashboardBoardPage() {
  const { projects, selectedProject, items } = await getSelectedProjectData()

  return (
    <DashboardBoardPageClient
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
    />
  )
}
