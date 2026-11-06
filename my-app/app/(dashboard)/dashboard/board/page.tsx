import { getSelectedProjectData } from "../data"
import { DashboardBoardPageShell } from "./page-shell"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function DashboardBoardPage({ searchParams }: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams
  const { projects, selectedProject, items } = await getSelectedProjectData(typeof projectId === "string" ? projectId : undefined)

  return (
    <DashboardBoardPageShell
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
    />
  )
}
