import { readAuthenticatedUser } from "@/lib/server-auth"
import { getSelectedProjectData } from "../data"

import { CoordinatorRoadmapChart } from "./coordinator-roadmap-chart"
import { CoordinatorRoadmapOverview } from "./coordinator-roadmap-overview"

export default async function RoadmapPage() {
  const user = await readAuthenticatedUser()

  if (!user?.id) {
    return null
  }

  const { selectedProject, items } = await getSelectedProjectData()

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a project or group to view its roadmap.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto pb-8 pr-1">
      <div className="w-full space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Project /</span>
          <span className="text-foreground">{selectedProject.name}</span>
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          Roadmap
        </h1>
      </div>

        <CoordinatorRoadmapChart
          groupCreatedAt={selectedProject.createdAt}
          items={items}
        />
        <CoordinatorRoadmapOverview project={selectedProject} items={items} />
      </div>
    </div>
  )
}
