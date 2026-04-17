import { getSelectedProjectData } from "../data"
import { BacklogPageClient } from "./page-client"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function BacklogPage() {
  const { projects, selectedProject, items } = await getSelectedProjectData()

  return (
    <BacklogPageClient
      initialProjects={projects}
      initialSelectedProjectId={selectedProject?.id ?? null}
      initialItems={items}
    />
  )
}
