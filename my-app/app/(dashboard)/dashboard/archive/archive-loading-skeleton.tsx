import { Skeleton } from "@/components/ui/skeleton"

export function ArchiveLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-7 w-24" />

        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          <Skeleton className="h-8 w-full sm:w-[220px]" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-xs dark:border-[#343434] dark:bg-[#1f1f1f]">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-[#343434] dark:bg-[#202020]">
          <div className="grid grid-cols-[36px_120px_90px_minmax(160px,1fr)_120px_140px_140px_44px] gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>

        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[36px_120px_90px_minmax(160px,1fr)_120px_140px_140px_44px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-[#343434]"
            >
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
