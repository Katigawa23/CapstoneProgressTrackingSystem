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

export function CoordinatorRoadmapChart({
  groupCreatedAt,
  items,
}: {
  groupCreatedAt: string
  items: BacklogApiItem[]
}) {
  const createdAt = new Date(groupCreatedAt)
  const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const rootItems = items.filter((item) => !item.parentId)
  const roadmapData = Array.from({ length: 5 }, (_, index) => {
    const monthStart = new Date(
      safeCreatedAt.getFullYear(),
      safeCreatedAt.getMonth() + index,
      1
    )
    const monthEnd = new Date(
      safeCreatedAt.getFullYear(),
      safeCreatedAt.getMonth() + index + 1,
      0,
      23,
      59,
      59,
      999
    )

    if (monthStart > currentMonthStart) {
      return {
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        value: null,
      }
    }

    const availableItems = rootItems.filter((item) => {
      const itemCreatedAt = item.createdAt ? new Date(item.createdAt) : safeCreatedAt
      return !Number.isNaN(itemCreatedAt.getTime()) && itemCreatedAt <= monthEnd
    })
    const completedItems = availableItems.filter((item) => {
      if (item.status !== "completed") return false
      const referenceDate = new Date(item.dueDate ?? item.createdAt ?? groupCreatedAt)
      return !Number.isNaN(referenceDate.getTime()) && referenceDate <= monthEnd
    })

    return {
      month: monthStart.toLocaleDateString("en-US", { month: "short" }),
      value:
        availableItems.length > 0
          ? Math.round((completedItems.length / availableItems.length) * 100)
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
            Percentage of group tasks completed over time.
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
