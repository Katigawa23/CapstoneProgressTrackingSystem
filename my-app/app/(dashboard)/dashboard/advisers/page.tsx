import { BadgeCheck, UserRoundCheck } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getSelectedProjectData } from "../data"

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
}

export default async function AdvisersPage() {
  const { selectedProject } = await getSelectedProjectData()

  return (
    <div className="h-full overflow-y-auto px-2 py-1 sm:px-4">
      <div className="mx-auto w-full space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Project /</span>
            <span className="text-foreground">
              {selectedProject?.name ?? "No project selected"}
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Adviser
          </h1>
          <p className="text-xs text-muted-foreground">
            View the faculty adviser assigned to this project or group.
          </p>
        </div>

        {!selectedProject ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center dark:border-[#3a414b]">
            <p className="text-sm text-muted-foreground">
              Select a project or group to view its adviser.
            </p>
          </div>
        ) : selectedProject.advisers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center dark:border-[#3a414b]">
            <UserRoundCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No adviser assigned</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The assigned faculty adviser will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedProject.advisers.map((adviser) => (
              <article
                key={adviser}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#3a414b] dark:bg-[#202329]"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-blue-600 text-sm font-semibold text-white">
                      {getInitials(adviser) || "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-950 dark:text-slate-100">
                      {adviser}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Faculty adviser</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-emerald-700 dark:border-[#343a43] dark:text-emerald-300">
                  <BadgeCheck className="h-4 w-4" />
                  Assigned to {selectedProject.name}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
