import { fileTypes, gridType, choiceType, isBlankSurveyAnswer, questionTypes, type SurveyAnswer, type SurveyQuestion } from "./task-survey"

export type AnswerFrequency = { question: number; answer: SurveyAnswer; count: number }
export type FileFrequency = { question: number; type: string; count: number; respondents: number }
export type TallyRow = { label: string; count: number; percent?: number; row?: string }
export type SurveyTally = {
  title: string
  chart: "pie" | "bar" | "column" | "stack" | "heatmap" | "histogram" | "text" | "paragraph"
  answered: number
  skipped: number
  rows: TallyRow[]
  average?: number
  maximum?: number
  files?: number
  written?: TallyRow[]
  numericValues?: TallyRow[]
}

const percentage = (count: number, total: number) => total ? count / total * 100 : 0
export const formatPercentage = (value: number) => value.toFixed(1).replace(/\.0$/, "") + "%"

export function combineSurveySelections(questions: SurveyQuestion[], tallies: SurveyTally[]) {
  const counts = new Map<string, number>()
  questions.forEach(({ type }, index) => {
    if (!choiceType(type) && !gridType(type)) return
    for (const { label, count } of tallies[index]?.rows ?? []) addCount(counts, label, count)
  })
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  return { total, rows: tallyRows([...counts.keys()], counts, total) }
}

export function combineSurveyResults(questions: SurveyQuestion[], tallies: SurveyTally[]) {
  const groups = new Map<string, { counts: Map<string, number>; unit: string; numeric: boolean }>()
  questions.forEach((question, index) => {
    const { type } = question
    if (choiceType(type) || gridType(type)) return
    const tally = tallies[index]
    const numeric = tally?.chart === "histogram"
    const score = type === "rating" || type === "scale"
    const name = type === "time" ? question.duration ? "Duration" : "Time of day"
      : numeric ? "Numeric short answer" : questionTypes[type]
    const unit = type === "file" ? "files" : "answers"
    const group = groups.get(name) ?? { counts: new Map<string, number>(), unit, numeric }
    groups.set(name, group)
    const rows = (numeric ? tally.numericValues : type === "paragraph" ? tally?.written : tally?.rows) ?? []
    for (const { label, count } of rows) {
      const result = score ? `${label} out of ${question.max ?? 5}` : label
      addCount(group.counts, result, count)
    }
  })
  return Array.from(groups, ([title, { counts, unit, numeric }]) => {
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
    const rows = numeric && total
      ? histogram(counts, total).map((row) => ({ ...row, percent: percentage(row.count, total) }))
      : tallyRows([...counts.keys()], counts, total)
    return { title, unit, total, rows }
  })
}

function tallyRows(labels: string[], counts: Map<string, number>, denominator?: number) {
  return labels.map((label) => {
    const count = counts.get(label) ?? 0
    return { label, count, percent: denominator === undefined ? undefined : percentage(count, denominator) }
  })
}

function addCount(counts: Map<string, number>, label: string, count: number) {
  counts.set(label, (counts.get(label) ?? 0) + count)
}

const numericAnswer = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const numberLabel = new Intl.NumberFormat("en", { maximumSignificantDigits: 12, useGrouping: false })

function histogram(values: Map<string, number>, total: number): TallyRow[] {
  const sorted = [...values].map(([answer, count]) => ({ value: Number(answer), count })).sort((a, b) => a.value - b.value)
  const min = sorted[0].value
  const max = sorted[sorted.length - 1].value
  if (min === max) return [{ label: numberLabel.format(min), count: total }]
  const bins = Math.min(10, sorted.length)
  const bounds = [...new Set(Array.from({ length: bins }, (_, index) => {
    const fraction = (index + 1) / bins
    return index === bins - 1 ? max : min * (1 - fraction) + max * fraction
  }).filter((bound) => bound > min))]
  const rows = bounds.map((upper, index) => ({
    label: `${numberLabel.format(index ? bounds[index - 1] : min)} ${index === bounds.length - 1 ? "–" : "to <"} ${numberLabel.format(upper)}`,
    count: 0,
  }))
  for (const entry of sorted) {
    const index = bounds.findIndex((upper) => entry.value < upper)
    rows[index === -1 ? rows.length - 1 : index].count += entry.count
  }
  return rows
}

const durations = ["Under 5 min", "5 to <15 min", "15 to <30 min", "30 to <60 min", "1 to <2 hr", "2 to <4 hr", "4 hr or more"]

function groupByQuestion<T extends { question: number }>(entries: T[]) {
  const groups = new Map<number, T[]>()
  for (const entry of entries) {
    const group = groups.get(entry.question)
    if (group) group.push(entry)
    else groups.set(entry.question, [entry])
  }
  return groups
}

export function buildSurveyTallies(questions: SurveyQuestion[], total: number, frequencies: AnswerFrequency[], files: FileFrequency[]): SurveyTally[] {
  const answersByQuestion = groupByQuestion(frequencies)
  const filesByQuestion = groupByQuestion(files)
  return questions.map((question, index) => {
    const entries = (answersByQuestion.get(index) ?? []).filter(({ answer }) => !isBlankSurveyAnswer(answer))
    let answered = entries.reduce((sum, entry) => sum + entry.count, 0)
    const result = (chart: SurveyTally["chart"], rows: TallyRow[], extra?: Partial<SurveyTally>): SurveyTally =>
      ({ title: question.label, chart, rows, answered, skipped: total - answered, ...extra })
    const counts = new Map<string, number>()
    const { type } = question
    if (type === "file") {
      const uploads = filesByQuestion.get(index) ?? []
      answered = uploads[0]?.respondents ?? 0
      for (const { type, count } of uploads) addCount(counts, fileTypes[type as keyof typeof fileTypes] ?? type, count)
      const labels = [...new Set([...(question.allowedTypes ?? []).map((type) => fileTypes[type as keyof typeof fileTypes] ?? type), ...counts.keys()])]
      return result("bar", tallyRows(labels, counts), { files: uploads.reduce((sum, entry) => sum + entry.count, 0) })
    }
    if (type === "grid" || type === "checkGrid") {
      const gridRows = (question.rows ?? []).map(() => ({ counts: new Map<string, number>(), answered: 0 }))
      for (const { answer, count } of entries) {
        if (!answer || typeof answer !== "object" || Array.isArray(answer)) continue
        for (const [row, value] of Object.entries(answer)) {
          const item = gridRows[Number(row)]
          if (!item || !value?.length) continue
          item.answered += count
          for (const option of new Set(Array.isArray(value) ? value : [value])) addCount(item.counts, option, count)
        }
      }
      return result(type === "grid" ? "stack" : "heatmap", gridRows.flatMap((item, index) =>
        tallyRows(question.options ?? [], item.counts, type === "grid" ? item.answered : undefined)
          .map((tally) => ({ ...tally, row: question.rows?.[index] }))))
    }
    if (type === "choice" || type === "dropdown" || type === "checks") {
      const options = [...(question.options ?? [])]
      let other = "Other (write-in)"
      while (options.includes(other)) other += " ·"
      if (question.other) options.push(other)
      for (const { answer, count } of entries) {
        const values = (Array.isArray(answer) ? answer : typeof answer === "string" ? [answer] : [])
          .map((value) => question.other && value.startsWith("Other: ") ? other : value)
        for (const value of new Set(values)) addCount(counts, value, count)
      }
      return result(type === "checks" || options.length > 5 ? "bar" : "pie", tallyRows(options, counts, answered))
    }
    for (const { answer, count } of entries) {
      if (typeof answer !== "string") continue
      let label = answer
      if (type === "date") label = answer.slice(0, 10)
      if (type === "time") {
        if (question.duration) {
          const [hours, minutes, seconds] = answer.split(":").map(Number)
          const duration = hours * 60 + minutes + seconds / 60
          const index = [5, 15, 30, 60, 120, 240].findIndex((end) => duration < end)
          label = durations[index === -1 ? durations.length - 1 : index]
        } else label = answer.slice(0, 2) + ":00"
      }
      addCount(counts, label, count)
    }
    if (type === "rating" || type === "scale") {
      const maximum = question.max ?? 5
      const minimum = question.min ?? 1
      const labels = Array.from({ length: maximum - minimum + 1 }, (_, index) => String(minimum + index))
      const sum = labels.reduce((total, label) => total + Number(label) * (counts.get(label) ?? 0), 0)
      return result("column", tallyRows(labels, counts), { average: answered ? sum / answered : undefined, maximum })
    }
    if (type === "date" || type === "time") {
      return result("column", tallyRows(type === "time" && question.duration ? durations : [...counts.keys()].sort(), counts))
    }
    if (type === "text" && counts.size && [...counts.keys()].every((value) => numericAnswer.test(value) && Number.isFinite(Number(value)))) {
      return result("histogram", histogram(counts, answered), { numericValues: tallyRows([...counts.keys()], counts) })
    }
    const written = tallyRows([...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b)), counts)
    if (type === "paragraph") {
      return result("paragraph", answered ? [{ label: "Written answers", count: answered }] : [], { written })
    }
    return result("text", written)
  })
}

export function surveyTallyCsvRows(tallies: SurveyTally[]) {
  return [
    ["Question tallies"],
    ["Question number", "Question", "Respondents answered", "Skipped", "Grid row", "Answer / range", "Count", "Percentage", "Average", "Maximum score", "Total files"],
    ...tallies.flatMap((tally, index) => (tally.rows.length ? tally.rows : [{ label: "", count: 0 } as TallyRow]).map((row) => [
      String(index + 1), tally.title, String(tally.answered), String(tally.skipped), row.row ?? "", row.label, String(row.count),
      row.percent === undefined ? "" : formatPercentage(row.percent), tally.average?.toFixed(2) ?? "",
      tally.maximum?.toString() ?? "", tally.files?.toString() ?? "",
    ])),
  ]
}
