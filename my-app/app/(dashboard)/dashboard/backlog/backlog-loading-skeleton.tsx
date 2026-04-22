import { Skeleton } from "@/components/ui/skeleton"

function BacklogRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-sm" />

        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="ml-3 flex items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
    </div>
  )
}

export function BacklogLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative w-[190px]">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-[#343434] dark:bg-[#1f1f1f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex items-center gap-2">
              <span className="font-medium text-black dark:text-slate-100">Board</span>
              <span className="text-sm text-black/60 dark:text-slate-400">(4 work items)</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-5 rounded" />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <BacklogRowSkeleton key={index} />
          ))}
        </div>

        <div className="flex">
          <span className="text-sm font-medium text-black dark:text-slate-100">Create</span>
        </div>
      </div>
    </div>
  )
}
