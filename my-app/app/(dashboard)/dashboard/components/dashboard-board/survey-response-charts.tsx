"use client"

import { useState, type PointerEvent } from "react"
import { combineSurveyResults, combineSurveySelections, formatPercentage, type SurveyTally, type TallyRow } from "@/lib/survey-tallies"
import type { SurveyQuestion } from "@/lib/task-survey"

const colors = ["#0284c7", "#0d9488", "#a855f7", "#ea580c", "#e11d48", "#4f46e5", "#65a30d", "#a16207"]
const color = (index: number) => colors[index % colors.length]

const selectionColors = ["#16a34a", "#2563eb", "#ea580c", "#9333ea", "#db2777", "#0d9488", "#ca8a04", "#dc2626"]
const selectionColor = (index: number) => selectionColors[index] ?? `hsl(${(index * 137.508) % 360} 65% 44%)`

export function SurveyOverallChart({ responseCount, questions, tallies }: {
  responseCount: number; questions: SurveyQuestion[]; tallies: SurveyTally[]
}) {
  const selections = combineSurveySelections(questions, tallies)
  const groups = combineSurveyResults(questions, tallies)
  return <div className="space-y-4">
    <h5 className="text-sm font-semibold">{responseCount} total submissions</h5>
    {selections.rows.length || !groups.length ? <OverallDistribution
      title="Combined answer selections" unit="selections" {...selections} /> : null}
    {groups.map((group) => <OverallDistribution key={group.title} {...group} />)}
  </div>
}

function OverallDistribution({ title, unit, rows, total }: {
  title: string; unit: string; rows: TallyRow[]; total: number
}) {
  const [activeLabel, setActiveLabel] = useState<string>()
  let counted = 0
  const slices = rows.flatMap((row, index) => {
    const { count } = row
    if (!count) return []
    const start = counted / total * 100
    counted += count
    return [{ ...row, start, end: counted / total * 100, color: selectionColor(index) }]
  })
  const activeIndex = rows.findIndex(({ label }) => label === activeLabel)
  const active = rows[activeIndex]

  function showSlice(event: PointerEvent<HTMLDivElement>) {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - left) / width - 0.5
    const y = (event.clientY - top) / height - 0.5
    if (event.target !== event.currentTarget || Math.hypot(x, y) > 0.5) {
      setActiveLabel(undefined)
      return
    }
    const position = ((Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1) * 100
    setActiveLabel(slices.find(({ start, end }) => position >= start && position < end)?.label)
  }

  return <section className="min-w-0 space-y-4 rounded-lg border p-4">
    <h6 className="font-semibold">{title}</h6>
    {total > 0 && slices.length <= 8 ? <div className="flex flex-wrap items-center justify-center gap-5">
      <div
        aria-hidden
        className="relative grid w-40 max-w-full aspect-square shrink-0 place-items-center rounded-full sm:w-48"
        onPointerMove={showSlice}
        onPointerDown={showSlice}
        onPointerLeave={() => setActiveLabel(undefined)}
        style={{ background: slices.length === 1 ? slices[0].color
          : `conic-gradient(${slices.map(({ color, start, end }) => `${color} ${start}% ${end}%`).join(", ")})` }}
      >
        <div className="flex size-[72%] flex-col items-center justify-center rounded-full bg-background text-center">
          <span className="pointer-events-none text-2xl font-semibold tabular-nums">{total}</span>
          <span className="pointer-events-none text-xs text-muted-foreground">Total {unit}</span>
        </div>
        {active ? <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
          <p className="break-words font-medium">{active.label}</p>
          <p className="text-xs tabular-nums">{active.count} · {formatPercentage(active.percent ?? 0)}</p>
        </div> : null}
      </div>
      <ul aria-label="Chart colors" className="w-full min-w-0 max-w-xs space-y-1 sm:w-auto">
        {rows.map(({ label, count, percent }, index) => <li key={label}>
          <button type="button" className={`flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted ${activeLabel === label ? "bg-muted" : ""}`}
            onPointerEnter={() => setActiveLabel(label)} onPointerLeave={() => setActiveLabel(undefined)}
            onFocus={() => setActiveLabel(label)} onBlur={() => setActiveLabel(undefined)}
            onClick={() => setActiveLabel(label)}>
            <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: selectionColor(index) }} />
            <span className="min-w-0 flex-1 break-words">{label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{count} · {formatPercentage(percent ?? 0)}</span>
          </button>
        </li>)}
      </ul>
    </div> : total ? <p className="text-sm font-medium">{total} total {unit}</p> : <p className="text-sm text-muted-foreground">No responses yet.</p>}
    {rows.length ? <table className="w-full table-fixed text-sm">
      <thead><tr className="border-b text-left">
        <th scope="col" className="pb-2">Result</th>
        <th scope="col" className="w-16 pb-2 text-right">Count</th>
        <th scope="col" className="w-16 pb-2 text-right">Share</th>
      </tr></thead>
      <tbody className="tabular-nums">
        {rows.map(({ label, count, percent }, index) => <tr key={label} className="border-b">
          <th scope="row" className="break-words py-2 pr-2 text-left font-normal">
            <span aria-hidden className="mr-2 inline-block size-2.5 rounded-sm" style={{ backgroundColor: selectionColor(index) }} />
            {label}
            {slices.length > 8 && count > 0 ? <span aria-hidden className="mt-1 block h-1.5 rounded-full"
              style={{ width: `${percent ?? 0}%`, backgroundColor: selectionColor(index) }} /> : null}
          </th>
          <td className="text-right">{count}</td><td className="text-right">{formatPercentage(percent ?? 0)}</td>
        </tr>)}
      </tbody>
      <tfoot className="font-semibold tabular-nums">
        <tr><th scope="row" className="py-2 text-left">Total {unit}</th>
          <td className="text-right">{total}</td><td className="text-right">{total ? "100%" : "0%"}</td></tr>
      </tfoot>
    </table> : null}
    {unit === "selections" ? <p className="text-sm text-muted-foreground">Matching options are combined across choice, dropdown, checkbox, and grid questions. Each selected option counts once.</p> : null}
  </section>
}

function ChartLegend({ rows }: { rows: TallyRow[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-2">
    {rows.map(({ label }, index) => <li key={label} className="flex min-w-0 items-start gap-2 break-words">
      <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color(index) }} />{label}
    </li>)}
  </ul>
}

function TallyVisual({ tally }: { tally: SurveyTally }) {
  const { rows, chart } = tally
  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 1)
  if (chart === "pie") {
    let angle = 0
    const slices = rows.flatMap(({ percent }, index) => {
      if (!percent) return []
      const start = angle
      angle += percent
      return [`${color(index)} ${start}% ${Math.min(100, angle)}%`]
    })
    return <div className="flex flex-wrap items-center gap-4">
      <div aria-hidden className="size-28 shrink-0 rounded-full border" style={{ background: `conic-gradient(${slices.length === 1 ? slices[0] + ", " + slices[0] : slices.join(",")})` }} />
      <ChartLegend rows={rows} />
    </div>
  }
  if (chart === "bar") return <div aria-hidden className="space-y-2">
    {rows.map(({ label, count, percent }) => <div key={label} className="space-y-1">
      <div className="flex justify-between gap-3"><span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 tabular-nums">{count}{percent !== undefined ? ` (${formatPercentage(percent)})` : ""}</span></div>
      <div className="h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${percent ?? count / max * 100}%` }} /></div>
    </div>)}
  </div>

  if (chart === "column" || chart === "histogram") return <div aria-hidden className="max-w-full overflow-x-auto">
    <div className="flex min-w-full gap-1 pb-2 sm:gap-2">
      {rows.map(({ label, count }) => <div key={label} className="flex min-w-11 max-w-24 flex-1 flex-col items-center text-center">
        <div className="flex h-32 w-full flex-col items-center justify-end border-b pb-1">
          <span className="tabular-nums">{count}</span>
          <div className="w-8 rounded-t bg-primary" style={{ height: `${count / max * 76}%` }} />
        </div>
        <span className="mt-1 w-full text-xs [overflow-wrap:anywhere] sm:text-sm">{label}</span>
      </div>)}
    </div>
  </div>
  if (chart !== "stack" && chart !== "heatmap") return null
  const groups = new Map<string, TallyRow[]>()
  for (const row of rows) {
    const label = row.row ?? ""
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)?.push(row)
  }
  const options = groups.values().next().value ?? []
  if (chart === "stack") return <div className="space-y-3">
    <ChartLegend rows={options} />
    {[...groups].map(([label, cells]) => <div key={label}>
      <p className="mb-1 break-words">{label}{cells.every((cell) => !cell.count) ? " · No answers" : ""}</p>
      <div aria-hidden className="flex h-5 overflow-hidden rounded bg-muted">
        {cells.map((cell, index) => <div key={cell.label} style={{ width: `${cell.percent ?? 0}%`, backgroundColor: color(index) }} />)}
      </div>
    </div>)}
  </div>
  return <div className="max-w-full overflow-x-auto" role="region" aria-label="Selection heatmap" tabIndex={0}>
    <table aria-label="Selection heatmap" className="w-full border-separate border-spacing-1 text-center">
      <thead><tr><th scope="col">Row</th>{options.map(({ label }) => <th scope="col" key={label} className="min-w-20 break-words p-1">{label}</th>)}</tr></thead>
      <tbody>{[...groups].map(([label, cells]) => <tr key={label}>
        <th scope="row" className="min-w-24 break-words p-1 text-left font-normal">{label}</th>
        {cells.map((cell) => <td key={cell.label} className="rounded border p-2 tabular-nums" style={{ backgroundColor: `rgb(14 165 233 / ${cell.count / max * .45})` }}>{cell.count}</td>)}
      </tr>)}</tbody>
    </table>
  </div>
}

export function SurveyResponseChart({ tally, question }: {
  tally: SurveyTally; question: SurveyQuestion
}) {
  const hasPercent = tally.rows.some((row) => row.percent !== undefined)
  const hasGridRows = tally.chart === "stack" || tally.chart === "heatmap"
  return <article className="min-w-0 space-y-3 rounded-lg border p-3 text-sm sm:p-4">
    <div>
      <h6 className="break-words font-semibold">{tally.title}</h6>
      <p className="text-muted-foreground">{tally.answered} answered · {tally.skipped} skipped</p>
      {tally.files !== undefined ? <p>{tally.files} total files</p> : null}
      {tally.average !== undefined ? <p>Average {tally.average.toFixed(1)} out of {tally.maximum}</p> : null}
    </div>
    {tally.answered ? <TallyVisual tally={tally} /> : <p className="text-muted-foreground">No responses yet</p>}
    {question.type === "checks" ? <p className="text-muted-foreground">Percentages can total more than 100% because respondents can select several options.</p> : null}
    {tally.rows.length ? <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left">
        <caption className="pb-1 text-left font-medium">{tally.chart === "text" ? "Answer frequency" : "Exact tally"}</caption>
        <thead><tr className="border-b">
          {hasGridRows ? <th scope="col" className="p-1.5">Row</th> : null}
          <th scope="col" className="p-1.5">Answer</th>
          <th scope="col" className="w-14 p-1.5 text-right">Count</th>
          {hasPercent ? <th scope="col" className="w-[4.75rem] p-1.5 text-right">Percent</th> : null}
        </tr></thead>
        <tbody>{tally.rows.map((row, index) => <tr key={index} className="border-b last:border-0">
          {hasGridRows ? <td className="break-words p-1.5">{row.row}</td> : null}
          <td className="whitespace-pre-wrap break-words p-1.5">{row.label}</td>
          <td className="p-1.5 text-right tabular-nums">{row.count}</td>
          {hasPercent ? <td className="p-1.5 text-right tabular-nums">{row.percent === undefined ? "" : formatPercentage(row.percent)}</td> : null}
        </tr>)}</tbody>
      </table>
    </div> : null}
    {tally.written?.length ? <details className="space-y-2">
      <summary className="cursor-pointer font-medium">All written responses</summary>
      <ul className="space-y-2">
        {tally.written.map(({ label, count }) => <li key={label} className="rounded-md border p-2">
          <p className="whitespace-pre-wrap break-words">{label}</p>
          {count > 1 ? <p className="text-xs text-muted-foreground">{count} respondents gave this answer</p> : null}
        </li>)}
      </ul>
    </details> : null}
  </article>
}
