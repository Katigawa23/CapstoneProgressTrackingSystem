import { Card, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

function ProjectCardSkeleton() {
  return (
    <Card className="relative flex min-h-[124px] w-full flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[color:rgba(var(--brand-primary-rgb),0.22)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.35)]" />
      <CardHeader className="flex-1 space-y-2 px-4 pb-2.5 pt-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>

        <div className="flex justify-end">
          <div className="flex items-center">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="-ml-2 h-7 w-7 rounded-full" />
            <Skeleton className="-ml-2 h-7 w-7 rounded-full" />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg px-1 py-1.5">
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton className="mt-0.5 h-6 w-6 rounded-md" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      <div className="shrink-0 space-y-2 text-right">
        <Skeleton className="ml-auto h-3 w-14" />
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
    </div>
  )
}

export function DashboardHomeSkeleton({
  hasProjects = true,
  projectCount = 4,
  workedOnCount = 4,
  showEmptyState = !hasProjects,
}: {
  hasProjects?: boolean
  projectCount?: number
  workedOnCount?: number
  showEmptyState?: boolean
}) {
  const visibleProjectSkeletons = Math.min(Math.max(projectCount, 1), 4)
  const visibleWorkedOnSkeletons = Math.max(workedOnCount, 1)

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-1 pb-6 pr-6 sm:pr-8 xl:px-2 xl:pr-10">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Choose a project</h1>
          <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />
        </div>

        {showEmptyState ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
            <h2 className="font-display text-lg font-semibold tracking-tight">No projects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a new project from the sidebar menu to start your thesis workspace.
            </p>
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              For you
            </h2>
            <span className="text-sm font-medium text-[var(--brand-primary-fixed)] dark:text-[#63a0d6]">
              View all projects
            </span>
          </div>

          {hasProjects ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: visibleProjectSkeletons }).map((_, index) => (
                <div key={index} className="w-full">
                  <ProjectCardSkeleton />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-px w-full bg-transparent" />
          )}
        </section>

        <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Recent projects
          </h2>
          {hasProjects ? (
            <div className="space-y-6 pt-4">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  In the last month
                </h3>
                <div className="space-y-2">
                  {Array.from({ length: visibleWorkedOnSkeletons }).map((_, index) => (
                    <ActivityRowSkeleton key={index} />
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="px-1 py-6 text-sm text-muted-foreground">
              No recent board activity yet.
            </div>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
