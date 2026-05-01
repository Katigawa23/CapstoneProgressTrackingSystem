import { getSelectedProjectData } from "../../data"
import { DashboardBoardPageClient } from "../../board/page-client"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function ActiveSprintBoardPage({
  params,
}: {
  params: Promise<{ sprintId: string }>
}) {
  const { sprintId } = await params
  const { projects, selectedProject, items } = await getSelectedProjectData()

  return (
    <DashboardBoardPageClient
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
      initialSprintId={sprintId}
      breadcrumbSectionLabel="Active Sprint"
      onProjectBoardSelectPath="/dashboard/active-sprint"
    />
  )
}
