import * as React from "react"

import { Loading } from "@/components/ui/loading"
import { cn } from "@/lib/utils"

type LoadingScreenProps = React.ComponentProps<"div"> & {
  label?: string
}

export function LoadingScreen({
  className,
  label = "Loading...",
  ...props
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px]",
        className
      )}
      {...props}
    >
      <div className="flex flex-col items-center gap-3 rounded-[2px] bg-white/95 px-6 py-5 shadow-lg dark:bg-[#171717]/95">
        <Loading />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </p>
      </div>
    </div>
  )
}
