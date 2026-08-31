import { readAuthenticatedUser } from "@/lib/server-auth"

import { CoordinatorRoadmapChart } from "./coordinator-roadmap-chart"
import { CoordinatorRoadmapOverview } from "./coordinator-roadmap-overview"

export default async function RoadmapPage() {
  const user = await readAuthenticatedUser()

  if (user?.id !== "tester-coordinator") {
    return <div>Roadmap Page</div>
  }

  return (
    <div className="h-full overflow-y-auto pb-8 pr-1">
      <div className="w-full space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Project /</span>
          <span className="text-foreground">Capstone 1</span>
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          Roadmap
        </h1>
      </div>

        <CoordinatorRoadmapChart />
        <CoordinatorRoadmapOverview />
      </div>
    </div>
  )
}
