"use client"

import type { LucideIcon } from "lucide-react"
import { getProjectMonogram } from "@/lib/projects"
import { cn } from "@/lib/utils"

type ProjectMonogramProps = {
  active?: boolean
  className?: string
  icon?: LucideIcon
  name: string
  seed?: string
  size?: "default" | "large"
}

const PROJECT_MONOGRAM_STYLES = [
  "border-rose-200 bg-rose-500 text-white dark:border-rose-400/40 dark:bg-rose-500 dark:text-white",
  "border-orange-200 bg-orange-500 text-white dark:border-orange-400/40 dark:bg-orange-500 dark:text-white",
  "border-amber-200 bg-amber-500 text-white dark:border-amber-400/40 dark:bg-amber-500 dark:text-white",
  "border-emerald-200 bg-emerald-500 text-white dark:border-emerald-400/40 dark:bg-emerald-500 dark:text-white",
  "border-teal-200 bg-teal-500 text-white dark:border-teal-400/40 dark:bg-teal-500 dark:text-white",
  "border-cyan-200 bg-cyan-500 text-white dark:border-cyan-400/40 dark:bg-cyan-500 dark:text-white",
  "border-[color:rgba(var(--brand-primary-rgb),0.18)] bg-[#0B5793] text-white dark:border-[color:rgba(var(--brand-primary-rgb),0.4)] dark:bg-[#0B5793] dark:text-white",
  "border-indigo-200 bg-indigo-500 text-white dark:border-indigo-400/40 dark:bg-indigo-500 dark:text-white",
  "border-violet-200 bg-violet-500 text-white dark:border-violet-400/40 dark:bg-violet-500 dark:text-white",
  "border-fuchsia-200 bg-fuchsia-500 text-white dark:border-fuchsia-400/40 dark:bg-fuchsia-500 dark:text-white",
]

function getProjectMonogramStyle(seed: string) {
  const normalizedSeed = seed.trim().toLowerCase()

  if (!normalizedSeed) {
    return PROJECT_MONOGRAM_STYLES[0]
  }

  const hash = normalizedSeed.split("").reduce((total, character) => {
    return total + character.charCodeAt(0)
  }, 0)

  return PROJECT_MONOGRAM_STYLES[hash % PROJECT_MONOGRAM_STYLES.length]
}

export function ProjectMonogram({
  active = false,
  className,
  icon: Icon,
  name,
  seed,
  size = "default",
}: ProjectMonogramProps) {
  const label = getProjectMonogram(name)
  const monogramStyle = getProjectMonogramStyle(seed ?? name)

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border font-bold uppercase tracking-[0.12em]",
        size === "large" ? "h-8 w-8 text-[11px]" : "h-7 w-7 text-[10px]",
        Icon
          ? active
            ? "border-[color:rgba(var(--brand-primary-rgb),0.18)] bg-[color:rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary-fixed)] dark:border-[color:rgba(var(--brand-primary-rgb),0.4)] dark:bg-[#111827] dark:text-[#63a0d6]"
            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-300"
          : monogramStyle,
        className
      )}
    >
      {Icon ? (
        <Icon className={cn(size === "large" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      ) : (
        <span className="leading-none font-bold text-white">{label}</span>
      )}
    </div>
  )
}
