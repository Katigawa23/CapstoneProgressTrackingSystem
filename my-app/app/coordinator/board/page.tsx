import { getSelectedProjectData } from "@/app/(dashboard)/dashboard/data"
import { DashboardBoardPageShell } from "@/app/(dashboard)/dashboard/board/page-shell"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function CoordinatorBoardPage() {
  const { projects, selectedProject, items } = await getSelectedProjectData()

  return (
    <DashboardBoardPageShell
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
      breadcrumbSectionLabel="Coordinator"
      onProjectBoardSelectPath="/coordinator/board"
    />
  )
}
