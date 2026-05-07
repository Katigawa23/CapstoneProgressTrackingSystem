import * as React from "react"

import { CustomLoader } from "@/components/ui/custom-loader"
import { cn } from "@/lib/utils"

type PageLoaderProps = React.ComponentProps<"div"> & {
  title?: string
  description?: string
  message?: string
  compact?: boolean
}

export function PageLoader({
  className,
  title = "Loading...",
  description,
  message,
  compact = false,
  ...props
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        compact
          ? "flex h-full min-h-[320px] items-center justify-center px-6"
          : "flex min-h-screen items-center justify-center px-6",
        "bg-[radial-gradient(circle_at_top,_rgba(51,127,221,0.16),_transparent_45%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_40%),linear-gradient(180deg,_#171717_0%,_#101828_100%)]",
        className
      )}
      {...props}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl border border-sky-100/80 bg-white/90 px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-slate-800 dark:bg-[#111827]/85 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
        </div>
        <CustomLoader size={80} color="#337FDD" aria-hidden="true" />
        {message ? (
          <p className="min-h-5 text-sm font-medium text-sky-700 dark:text-sky-300">{message}</p>
        ) : null}
      </div>
    </div>
  )
}
