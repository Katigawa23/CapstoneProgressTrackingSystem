import { Card, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

function ProjectCardSkeleton() {
  return (
    <Card className="relative flex min-h-[142px] w-full flex-col overflow-hidden rounded-none border-border/60 bg-card pt-0 shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-200/80 dark:bg-sky-900/60" />
      <CardHeader className="flex-1 space-y-3 px-4 pb-3 pt-3.5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
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

export function DashboardHomeSkeleton() {
  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-1 pb-6 pr-6 sm:pr-8 xl:px-2 xl:pr-10">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Choose a project</h1>
          <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Recent projects
            </h2>
            <span className="text-sm font-medium text-sky-700 dark:text-sky-400">
              View all projects
            </span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 2xl:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {Array.from({ length: 4 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-6 pt-4">
            <span className="text-sm font-medium text-blue-700">Worked on</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Assigned to me</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Viewed</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Starred</span>
          </div>
          <div className="mt-3 h-px w-full bg-slate-200 dark:bg-slate-800" />

          <div className="space-y-6 pt-6">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                In the last month
              </h3>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ActivityRowSkeleton key={index} />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
