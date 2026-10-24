import { readAuthenticatedUser } from "@/lib/server-auth"
import { listMilestoneTaskAssignments } from "@/lib/server-milestone-repository"
import { getSelectedProjectData } from "../data"
import { MilestonesView } from "./milestones-view"

export const dynamic = "force-dynamic"

export default async function MilestonesPage() {
  const [{ selectedProject, items }, user] = await Promise.all([
    getSelectedProjectData(),
    readAuthenticatedUser(),
  ])
  const assignments = selectedProject
    ? await listMilestoneTaskAssignments(selectedProject.id)
    : []

  return <MilestonesView
    projectId={selectedProject?.id ?? null}
    projectName={selectedProject?.name ?? "No project selected"}
    canManage={user?.role === "faculty" || user?.role === "admin"}
    tasks={items.filter((item) => !item.parentId).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      checked: item.checked,
      dueDate: item.dueDate,
      priority: item.priority,
    }))}
    initialAssignments={assignments}
  />
}
