"use client"

import type { LucideIcon } from "lucide-react"
import { getProjectMonogram } from "@/lib/projects"
import { cn } from "@/lib/utils"

type ProjectMonogramProps = {
  active?: boolean
  className?: string
  icon?: LucideIcon
  name: string
  size?: "default" | "large"
}

export function ProjectMonogram({
  active = false,
  className,
  icon: Icon,
  name,
  size = "default",
}: ProjectMonogramProps) {
  const label = getProjectMonogram(name)

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border font-semibold uppercase tracking-[0.12em]",
        size === "large" ? "h-8 w-8 text-[11px]" : "h-7 w-7 text-[10px]",
        active
          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-[#111827] dark:text-sky-300"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-300",
        className
      )}
    >
      {Icon ? <Icon className={cn(size === "large" ? "h-4 w-4" : "h-3.5 w-3.5")} /> : <span className="leading-none">{label}</span>}
    </div>
  )
}
