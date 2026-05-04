import { getSelectedProjectData } from "../data"
import { DashboardBoardPageShell } from "./page-shell"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function DashboardBoardPage() {
  const { projects, selectedProject, items, sprints } = await getSelectedProjectData()

  return (
    <DashboardBoardPageShell
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
      initialSprints={sprints}
    />
  )
}
