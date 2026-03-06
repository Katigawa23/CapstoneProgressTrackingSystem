import { ChevronDown, MoreHorizontal, Plus, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

import { type StatusOption, type WorkItem } from "../types"
import { StatusCombobox } from "./status-combobox"

type BacklogBoardProps = {
  items: WorkItem[]
  statusCounts: Array<StatusOption & { count: number }>
  onToggleCheckbox: (id: string, checked: boolean) => void
  onUpdateStatus: (id: string, nextStatus: string) => void
  onOpenCreate: () => void
}

export function BacklogBoard({
  items,
  statusCounts,
  onToggleCheckbox,
  onUpdateStatus,
  onOpenCreate,
}: BacklogBoardProps) {
  return (
    <Card className="flex flex-col gap-4 border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-black">
          <ChevronDown className="h-4 w-4" />
          Board
          <span className="text-sm text-black/60">
            ({items.length} work item{items.length === 1 ? "" : "s"})
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusCounts.map((status) => (
            <Badge
              key={status.value}
              variant="outline"
              className={cn(
                "h-5 min-w-5 rounded px-1.5 text-[10px] font-medium",
                status.color
              )}
            >
              {status.count}
            </Badge>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-10 text-center text-sm text-black/60">
          There&apos;s nothing on this board
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded border border-gray-200 px-2 py-1.5 text-sm transition hover:bg-muted/30"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(checked) => onToggleCheckbox(item.id, !!checked)}
                  className="h-4 w-4"
                />

                <span className="truncate text-[13px] font-medium text-black">
                  {item.title}
                </span>
              </div>

              <div className="ml-3 flex items-center gap-2">
                <StatusCombobox
                  value={item.status}
                  onChange={(nextStatus) => onUpdateStatus(item.id, nextStatus)}
                />

                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/15">
                  <User className="h-3.5 w-3.5 text-black/50" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-black/60 hover:bg-muted"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex">
        <Button variant="ghost" className="gap-2 text-black" onClick={onOpenCreate}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>
    </Card>
  )
}
