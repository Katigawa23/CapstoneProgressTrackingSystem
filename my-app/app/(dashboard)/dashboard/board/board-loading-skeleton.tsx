import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { columns, people } from "../constants"
import { DashboardHeader } from "../components/dashboard-header"
import type { DashboardBoardState } from "@/lib/dashboard-board-state"

function BoardCardSkeleton() {
  return (
    <div className="rounded-none border border-border/60 bg-card p-3 shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-3/5" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-3 w-3 rounded-sm" />
        <Skeleton className="h-3 w-20" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#343434]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-3 w-7" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  )
}

function BoardColumnSkeleton({
  title,
  color,
  cards,
}: {
  title: string
  color: string
  cards: number
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-[20px] border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        </div>
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col justify-between gap-4">
        <div className="space-y-3">
          {Array.from({ length: cards }).map((_, index) => (
            <BoardCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BoardHeaderStatic() {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        Project / <span className="text-foreground">Capstone1(Group1)</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">Board</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="sm"
            className="min-h-8 self-start hover:opacity-90 sm:self-auto"
            style={{
              backgroundColor: "var(--brand-primary-fixed)",
              color: "var(--brand-primary-fixed-foreground)",
            }}
          >
            Create
          </Button>

          <div className="relative w-full sm:w-[220px]">
            <Input className="h-8 w-full pl-8 text-xs" placeholder="Search" readOnly />
          </div>

          <div className="flex items-center">
            {people.map((person, index) => (
              <Avatar
                key={person.name}
                className={`h-5 w-5 ring-2 ring-background ${index === 0 ? "" : "-ml-1.5"}`}
              >
                <AvatarFallback className="text-[8px]">{person.name}</AvatarFallback>
              </Avatar>
            ))}
            <Avatar className="h-5 w-5 ring-2 ring-background -ml-1.5">
              <AvatarFallback className="text-[8px]">+</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BoardLoadingSkeleton({
  useLiveHeader = false,
  cardCounts,
}: {
  useLiveHeader?: boolean
  cardCounts?: DashboardBoardState
}) {
  const visibleCardCounts = [
    cardCounts?.todoCount ?? 0,
    cardCounts?.inprogressCount ?? 0,
    cardCounts?.revisionCount ?? 0,
    cardCounts?.completedCount ?? 0,
  ]

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      {useLiveHeader ? <DashboardHeader people={people} /> : <BoardHeaderStatic />}

      <div className="hidden min-h-0 flex-1 items-stretch gap-3 overflow-hidden md:grid md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column, index) => (
          <BoardColumnSkeleton
            key={column.id}
            title={column.title}
            color={column.color}
            cards={visibleCardCounts[index] ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
