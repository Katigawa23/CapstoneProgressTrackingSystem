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
          ? "flex h-full min-h-[min(320px,70dvh)] items-center justify-center px-3 sm:px-6"
          : "flex min-h-dvh items-center justify-center px-3 py-4 sm:px-6",
        "bg-[radial-gradient(circle_at_top,_rgba(0,127,168,0.16),_transparent_45%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(0,127,168,0.18),_transparent_40%),linear-gradient(180deg,_var(--background)_0%,_#101828_100%)]",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-[color:rgba(var(--brand-primary-rgb),0.12)] bg-white/90 px-4 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:gap-8 sm:px-8 sm:py-10 dark:border-slate-800 dark:bg-[#111827]/85 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
        </div>
        <CustomLoader size={80} color="var(--brand-primary-fixed)" aria-hidden="true" />
        {message ? (
          <p className="min-h-5 text-sm font-medium text-[var(--brand-primary-fixed)] dark:text-[var(--brand-link)]">{message}</p>
        ) : null}
      </div>
    </div>
  )
}
