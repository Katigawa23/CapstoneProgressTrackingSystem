import { ChevronsDown, ChevronsUp, Equal } from "lucide-react"

import type { TodoItem } from "../types"

type PriorityIconProps = {
  priority: TodoItem["priority"]
  className?: string
}

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  if (priority === "High") {
    return <ChevronsUp className={className ?? "h-4 w-4 text-red-500"} />
  }

  if (priority === "Low") {
    return <ChevronsDown className={className ?? "h-4 w-4 text-sky-500"} />
  }

  return <Equal className={className ?? "h-4 w-4 text-orange-500"} />
}
