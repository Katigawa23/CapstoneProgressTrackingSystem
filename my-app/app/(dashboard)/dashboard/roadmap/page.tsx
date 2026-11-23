import { Map } from "lucide-react"

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
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <header className="flex items-center gap-3 border-b border-border pb-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color:rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary-fixed)] dark:text-cyan-300">
            <Map className="size-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Roadmap
          </h1>
        </header>

        <CoordinatorRoadmapChart
          groupCreatedAt={selectedProject.createdAt}
          items={items}
        />
        <CoordinatorRoadmapOverview project={selectedProject} items={items} />
      </div>
    </div>
  )
}
