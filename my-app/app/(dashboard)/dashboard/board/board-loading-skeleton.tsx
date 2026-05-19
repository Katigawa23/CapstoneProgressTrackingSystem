import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CalendarDays,
  Ellipsis,
  GitFork,
  MessageSquareMore,
  MoreHorizontal,
  UserRound,
} from "lucide-react"
import { columns, people } from "../constants"
import type { DashboardBoardState } from "@/lib/dashboard-board-state"

function BoardCardSkeleton({ color }: { color: string }) {
  return (
    <div className="relative pt-1">
      <div className="w-full border border-[var(--board-task-border)] bg-[var(--board-task-bg)] p-2 text-left shadow-[var(--board-task-shadow)]">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
            />
            <Skeleton className="h-3 w-10" />
          </span>
        </div>

        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <button
            type="button"
            disabled
            aria-label="Loading task actions"
            className="shrink-0 rounded-sm p-1 text-slate-400 dark:text-slate-500"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-3 w-3" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="my-1.5 h-px bg-slate-200 dark:bg-[#3a3a3a]" />

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <MessageSquareMore className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              <Skeleton className="h-3 w-3" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 dark:text-slate-500">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            </div>
            <div className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 dark:border-[#4a4a4a]">
              <UserRound className="h-3 w-3 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BoardColumnSkeleton({
  title,
  color,
  previewCards,
  className = "",
}: {
  title: string
  color: string
  previewCards: number
  className?: string
}) {
  return (
    <Card className={`flex h-full min-h-0 min-w-0 flex-col rounded-xl border-[color:var(--board-column-border)] bg-[var(--board-column-bg)] shadow-[var(--board-column-shadow)] ${className}`}>
      <CardHeader className="px-0 pb-0 pt-1.5">
        <div className="px-3 pb-1.5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold dark:text-slate-100">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <Skeleton className="h-3 w-16 rounded-sm" />
              <span className="inline-flex items-center">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  (
                </span>
                <Skeleton className="mx-1 h-3 w-4 rounded-sm" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  )
                </span>
              </span>
            </CardTitle>

            <button
              type="button"
              aria-label={`${title} actions`}
              disabled
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 dark:text-slate-400"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-0 h-px w-full bg-slate-200 dark:bg-[#343434]" />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-2 pt-0">
        <div className="board-column-scroll h-[240px] w-full overflow-y-auto pt-0 pr-2 pb-2 sm:h-[280px] lg:h-[340px] xl:h-[420px]">
          <div className={`space-y-0.5 ${previewCards === 0 ? "h-full" : ""}`}>
            {Array.from({ length: previewCards }).map((_, index) => (
              <BoardCardSkeleton key={index} color={color} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BoardHeaderStatic() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-12" />
        <span>/</span>
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-20" />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <Skeleton className="h-8 min-w-0 flex-1 rounded-md sm:w-[220px] sm:flex-none" />
            <Skeleton className="h-8 w-24 rounded-md" />

            <div className="flex shrink-0 items-center">
              {people.slice(0, 3).map((person, index) => (
                <Skeleton
                  key={person.name}
                  className={`h-7 w-7 rounded-full ring-2 ring-background ${
                    index === 0 ? "" : "-ml-2"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BoardLoadingSkeleton({
  cardCounts,
}: {
  cardCounts?: DashboardBoardState
}) {
  const columnCounts = [
    cardCounts?.todoCount ?? 0,
    cardCounts?.inprogressCount ?? 0,
    cardCounts?.revisionCount ?? 0,
    cardCounts?.completedCount ?? 0,
  ]
  const visibleCardCounts = columnCounts.map((count) =>
    count <= 0 ? 0 : Math.min(count, 2)
  )

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-hidden">
      <BoardHeaderStatic />

      <div className="md:hidden min-h-0 flex-1 overflow-x-auto px-2 sm:px-4">
        <div className="flex min-h-0 w-max items-stretch gap-3">
          {columns.map((column, index) => (
            <BoardColumnSkeleton
              key={column.id}
              title={column.title}
              color={column.color}
              previewCards={visibleCardCounts[index] ?? 0}
              className="min-w-[280px]"
            />
          ))}
        </div>
      </div>

      <div className="hidden min-h-0 w-full flex-1 items-stretch gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
        {columns.map((column, index) => (
          <BoardColumnSkeleton
            key={column.id}
            title={column.title}
            color={column.color}
            previewCards={visibleCardCounts[index] ?? 0}
          />
        ))}
      </div>
    </div>
  )
}
