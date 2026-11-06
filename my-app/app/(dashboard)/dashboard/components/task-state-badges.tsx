import { cn } from "@/lib/utils"

import { getStatusOption } from "../backlog/types"
import type { TodoItem } from "../types"
import { PriorityIcon } from "./priority-icon"

const priorityStyles: Record<TodoItem["priority"], string> = {
  High: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  Medium: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300",
  Low: "border-[color:rgba(var(--brand-primary-rgb),0.2)] bg-[color:rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary-fixed)] dark:border-[color:rgba(var(--brand-primary-rgb),0.35)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.18)] dark:text-[#9bc2e2]",
}

export function PriorityBadge({
  priority = "Medium",
  iconOnly = false,
  className,
}: {
  priority?: TodoItem["priority"]
  iconOnly?: boolean
  className?: string
}) {
  return (
    <span
      role={iconOnly ? "img" : undefined}
      aria-label={iconOnly ? `Priority: ${priority}` : undefined}
      title={iconOnly ? `Priority: ${priority}` : undefined}
      className={cn(
        "inline-flex h-6 shrink-0 items-center border text-[11px] font-medium",
        iconOnly ? "w-6 justify-center rounded-full" : "gap-1.5 rounded px-2",
        priorityStyles[priority],
        className
      )}
    >
      <PriorityIcon priority={priority} className={iconOnly ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {iconOnly ? null : priority}
    </span>
  )
}

export function TaskStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const option = getStatusOption(status)

  return (
    <span className={cn(
      "inline-flex h-6 items-center rounded border px-2 text-[11px] font-medium dark:bg-[#262626] dark:text-slate-200",
      option.color,
      className
    )}>
      {option.label}
    </span>
  )
}
