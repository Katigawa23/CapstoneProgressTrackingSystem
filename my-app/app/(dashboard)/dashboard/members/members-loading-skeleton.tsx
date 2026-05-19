import { Skeleton } from "@/components/ui/skeleton"

export function MembersLoadingSkeleton() {
  return (
    <div className="space-y-4 px-2 py-1 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64" />
      </div>

      <Skeleton className="h-8 w-full max-w-sm" />

      <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-white shadow-sm dark:border-[#2f313a] dark:bg-[#20212a]">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-[#2d2f38] dark:bg-[#171821]">
          <div className="grid grid-cols-[48%_24%_28%] gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>

        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[48%_24%_28%] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-[#2d2f38]"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-24" />
              <div className="flex justify-end">
                <Skeleton className="h-6 w-6 rounded-[5px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
