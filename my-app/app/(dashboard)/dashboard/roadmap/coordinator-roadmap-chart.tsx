"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { BacklogApiItem } from "../types"

const chartConfig = {
  value: {
    label: "Progress",
    color: "var(--brand-primary-fixed)",
  },
} satisfies ChartConfig

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getTaskMonthKey(item: BacklogApiItem) {
  const taskDateValue = item.dueDate ?? item.startDate ?? item.createdAt

  if (!taskDateValue) return null

  // Keep date-only values in their written calendar month. Parsing a YYYY-MM-DD
  // string as UTC can move it to the previous month in some time zones.
  const calendarDateMatch = /^(\d{4})-(\d{2})(?:-|T|$)/.exec(taskDateValue)

  if (calendarDateMatch) {
    const monthNumber = Number(calendarDateMatch[2])

    if (monthNumber >= 1 && monthNumber <= 12) {
      return `${calendarDateMatch[1]}-${calendarDateMatch[2]}`
    }
  }

  const taskDate = new Date(taskDateValue)
  return Number.isNaN(taskDate.getTime()) ? null : getMonthKey(taskDate)
}

export function CoordinatorRoadmapChart({
  groupCreatedAt,
  items,
}: {
  groupCreatedAt: string
  items: BacklogApiItem[]
}) {
  const createdAt = new Date(groupCreatedAt)
  const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt
  const rootItems = items.filter((item) => !item.parentId)
  const roadmapData = Array.from({ length: 5 }, (_, index) => {
    const monthStart = new Date(
      safeCreatedAt.getFullYear(),
      safeCreatedAt.getMonth() + index,
      1
    )
    const monthKey = getMonthKey(monthStart)
    const itemsForMonth = rootItems.filter(
      (item) => getTaskMonthKey(item) === monthKey
    )
    const completedItems = itemsForMonth.filter(
      (item) => item.status === "completed"
    )

    return {
      month: monthStart.toLocaleDateString("en-US", { month: "short" }),
      value:
        rootItems.length > 0
          ? Math.round((completedItems.length / rootItems.length) * 100)
          : 0,
    }
  })
  const groupCreatedLabel = safeCreatedAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#3a414b] dark:bg-[#202329]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Group task progress
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Share of all group tasks completed for each task month.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Group created
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            {groupCreatedLabel}
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[210px] w-full">
        <BarChart data={roadmapData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent formatter={(value) => `${value}%`} />}
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </section>
  )
}
