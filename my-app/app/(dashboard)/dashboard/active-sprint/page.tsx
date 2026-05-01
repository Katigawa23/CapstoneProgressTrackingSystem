import { getSelectedProjectData } from "../data"
import { ActiveSprintPageClient } from "./page-client"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function ActiveSprintPage() {
  const { projects, selectedProject, items } = await getSelectedProjectData()

  return (
    <ActiveSprintPageClient
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
    />
  )
}
