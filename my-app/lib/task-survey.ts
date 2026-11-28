export const questionTypes = {
  text: "Short answer", paragraph: "Paragraph", choice: "Multiple choice", checks: "Checkboxes",
  dropdown: "Dropdown", file: "File upload", scale: "Linear scale", rating: "Rating",
  grid: "Multiple-choice grid", checkGrid: "Checkbox grid", date: "Date", time: "Time",
} as const
export type QuestionType = keyof typeof questionTypes
export const fileTypes = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPEG", "text/plain": "Plain text", "text/csv": "CSV" }
export type SurveyQuestion = {
  label: string
  type: QuestionType
  required?: boolean
  section?: string
  options?: string[]
  rows?: string[]
  other?: boolean
  branches?: Record<string, string>
  min?: number
  max?: number
  startLabel?: string
  endLabel?: string
  icon?: "star" | "heart" | "thumb"
  includeTime?: boolean
  duration?: boolean
  allowedTypes?: string[]
  maxSize?: number
  maxFiles?: number
}
export type SurveySection = { id: string; title: string; description: string; image?: string; video?: string }
export type SurveySettings = { confirmation: string; collectEmail: boolean; requireSignIn: boolean; limitOne: boolean }
export type SurveyDefinition = {
  title: string; purpose: string; questions: SurveyQuestion[]; sections?: SurveySection[]; settings?: SurveySettings
}
export type SurveyAnswer = string | string[] | Record<string, string | string[]> | null
export const defaultSections: SurveySection[] = [{ id: "main", title: "", description: "" }]
export const defaultSurveySettings: SurveySettings = {
  confirmation: "Thank you. Your response has been recorded.", collectEmail: false, requireSignIn: false, limitOne: false,
}
export const maxSurveyBytes = 4_000_000

export function isSurveyId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
}

export function isSurveyEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const trimmed = (value: unknown, limit: number) => typeof value === "string" && value.length <= limit ? value.trim() : ""
const strings = (value: unknown): string[] => Array.isArray(value) ? value.slice(0, 20).map((entry) => trimmed(entry, 160)) : []
export const choiceType = (type: QuestionType) => type === "choice" || type === "checks" || type === "dropdown"
export const gridType = (type: QuestionType) => type === "grid" || type === "checkGrid"

function mediaUrl(value: unknown, video = false) {
  const input = trimmed(value, 1000)
  if (!input) return ""
  try {
    const url = new URL(input)
    if (url.protocol !== "https:" || url.username || url.password) return ""
    if (!video) return url.href
    if (["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"].includes(url.hostname)) {
      const id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.split("/")[2]
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id : ""
    }
    return url.pathname.toLowerCase().endsWith(".mp4") ? url.href : ""
  } catch { return "" }
}

export function readSurveyDefinition(input: unknown, draft = false): SurveyDefinition | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Partial<SurveyDefinition>
  if (!Array.isArray(raw.questions) || raw.questions.length > 80) return null
  const title = trimmed(raw.title, 120)
  const purpose = trimmed(raw.purpose, 2000)
  if (!draft && (!title || !raw.questions.length)) return null
  if (raw.sections !== undefined && (!Array.isArray(raw.sections) || !raw.sections.length || raw.sections.length > 15)) return null
  const sections: SurveySection[] = []
  for (const section of raw.sections ?? defaultSections) {
    if (!section || typeof section.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(section.id) || sections.some(({ id }) => id === section.id)) return null
    const image = mediaUrl(section.image)
    const video = mediaUrl(section.video, true)
    if (!draft && ((section.image && !image) || (section.video && !video))) return null
    sections.push({
      id: section.id, title: trimmed(section.title, 120), description: trimmed(section.description, 2000),
      image: draft ? trimmed(section.image, 1000) : image, video: draft ? trimmed(section.video, 1000) : video,
    })
  }
  const settings: SurveySettings = {
    confirmation: trimmed(raw.settings?.confirmation, 1000) || defaultSurveySettings.confirmation,
    collectEmail: raw.settings?.collectEmail === true,
    requireSignIn: raw.settings?.requireSignIn === true || raw.settings?.limitOne === true,
    limitOne: raw.settings?.limitOne === true,
  }
  const questions: SurveyQuestion[] = []
  for (const question of raw.questions) {
    if (!question || typeof question.type !== "string" || !Object.hasOwn(questionTypes, question.type)) return null
    const label = trimmed(question.label, 240)
    if (!draft && !label) return null
    const section = question.section ?? sections[0].id
    const sectionIndex = sections.findIndex(({ id }) => id === section)
    if (sectionIndex < 0) return null
    const item: SurveyQuestion = { label, type: question.type, required: question.required !== false, section }
    if (choiceType(item.type) || gridType(item.type)) {
      item.options = strings(question.options)
      if (!draft && (!item.options.length || item.options.some((option) => !option || option.startsWith("Other: ")) ||
          new Set(item.options).size !== item.options.length)) return null
      if (gridType(item.type)) {
        item.rows = strings(question.rows)
        if (!draft && (!item.rows.length || item.rows.some((row) => !row) || new Set(item.rows).size !== item.rows.length)) return null
      }
      if (item.type === "choice" || item.type === "checks") item.other = question.other === true
      if (item.type === "choice" || item.type === "dropdown") {
        item.branches = Object.fromEntries(item.options.flatMap((option) => {
          const to = question.branches?.[option]
          return typeof to === "string" && sections.findIndex(({ id }) => id === to) > sectionIndex ? [[option, to]] : []
        }))
      }
    }
    if (item.type === "scale" || item.type === "rating") {
      item.min = item.type === "rating" ? 1 : question.min === 0 ? 0 : 1
      item.max = Number.isInteger(question.max) && question.max! >= 2 && question.max! <= 10 ? question.max : 5
      item.startLabel = trimmed(question.startLabel, 80)
      item.endLabel = trimmed(question.endLabel, 80)
      item.icon = question.icon === "heart" || question.icon === "thumb" ? question.icon : "star"
    }
    if (item.type === "file") {
      item.allowedTypes = Array.isArray(question.allowedTypes) ? [...new Set(question.allowedTypes.filter((type) => typeof type === "string" && Object.hasOwn(fileTypes, type)))] : ["application/pdf"]
      if (!draft && !item.allowedTypes.length) return null
      item.maxFiles = Number.isInteger(question.maxFiles) && question.maxFiles! >= 1 && question.maxFiles! <= 5 ? question.maxFiles : 1
      item.maxSize = Number.isInteger(question.maxSize) && question.maxSize! >= 1 && question.maxSize! <= 3 ? question.maxSize : 1
    }
    if (item.type === "date") item.includeTime = question.includeTime === true
    if (item.type === "time") item.duration = question.duration === true
    questions.push(item)
  }
  return { title, purpose, questions, sections, settings }
}

export function nextSurveySection(survey: SurveyDefinition, current: string, answers: unknown[]) {
  const sections = survey.sections ?? defaultSections
  for (const [index, question] of survey.questions.entries()) {
    if ((question.section ?? sections[0].id) !== current || !question.branches) continue
    const value = answers[index]
    if (typeof value !== "string" || !question.options?.includes(value)) continue
    const next = question.branches[value]
    if (next && sections.findIndex(({ id }) => id === next) > sections.findIndex(({ id }) => id === current)) return next
  }
  return sections[sections.findIndex(({ id }) => id === current) + 1]?.id
}

export function isBlankSurveyAnswer(value: unknown) {
  return value == null || (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && !value.length) ||
    (typeof value === "object" && !Array.isArray(value) && Object.values(value).every((entry) => !entry || (Array.isArray(entry) && !entry.length)))
}

function validDate(value: string, includeTime: boolean) {
  const pattern = includeTime ? /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/ : /^\d{4}-\d{2}-\d{2}$/
  if (!pattern.test(value)) return false
  const day = value.slice(0, 10)
  const date = new Date(day + "T00:00:00Z")
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
}

export function surveyAnswerError(question: SurveyQuestion, value: unknown, files: readonly File[] = []): string | undefined {
  if (question.type === "file") {
    if (!files.length) return question.required === false ? undefined : "Attach a file."
    if (files.length > (question.maxFiles ?? 1) || files.some((file) =>
      !question.allowedTypes?.includes(file.type) || !file.size || file.size > (question.maxSize ?? 1) * 1_000_000)) {
      return "Check the allowed file types, file size and number of files."
    }
    return
  }
  if (isBlankSurveyAnswer(value)) return question.required === false ? undefined : "Answer this question."
  const invalid = "Enter a valid answer."
  const validOption = (entry: unknown) => typeof entry === "string" &&
    (question.options?.includes(entry) || (question.other && entry.startsWith("Other: ") && entry.slice(7).trim().length > 0 && entry.length <= 500))
  const validOptions = (entry: unknown) => Array.isArray(entry) && entry.length > 0 && new Set(entry).size === entry.length && entry.every(validOption)
  if (question.type === "choice" || question.type === "dropdown") return validOption(value) ? undefined : invalid
  if (question.type === "checks") return validOptions(value) ? undefined : invalid
  if (gridType(question.type)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid
    const entries = Object.entries(value)
    const rows = question.rows ?? []
    if (question.required !== false && rows.some((_, i) => isBlankSurveyAnswer((value as Record<string, unknown>)[i]))) return "Answer each row."
    return entries.every(([row, answer]) =>
      /^(0|[1-9]\d*)$/.test(row) && Number(row) < rows.length &&
      (isBlankSurveyAnswer(answer) || (question.type === "grid" ? validOption(answer) : validOptions(answer)))
    ) ? undefined : invalid
  }
  if (typeof value !== "string") return invalid
  if (question.type === "rating" || question.type === "scale") {
    return /^\d+$/.test(value) && Number(value) >= (question.min ?? 1) && Number(value) <= (question.max ?? 5) ? undefined : invalid
  }
  if (question.type === "date") return validDate(value, question.includeTime === true) ? undefined : invalid
  if (question.type === "time") {
    const pattern = question.duration ? /^\d{1,3}:[0-5]\d:[0-5]\d$/ : /^(?:[01]\d|2[0-3]):[0-5]\d$/
    return pattern.test(value) ? undefined : invalid
  }
  if (question.type === "text") return value.length <= 1000 && !/[\r\n]/.test(value) ? undefined : invalid
  return value.length <= 2000 ? undefined : invalid
}

export function validateSurveyResponse(survey: SurveyDefinition, input: unknown, files: Map<number, File[]> = new Map()) {
  if (!Array.isArray(input) || input.length !== survey.questions.length) return null
  const sections = survey.sections ?? defaultSections
  const answers: SurveyAnswer[] = survey.questions.map(() => null)
  const errors: Record<number, string> = {}
  const visited = new Set<number>()
  let current: string | undefined = sections[0].id
  while (current) {
    survey.questions.forEach((question, index) => {
      if ((question.section ?? sections[0].id) !== current) return
      visited.add(index)
      const value = input[index]
      const error = surveyAnswerError(question, value, files.get(index))
      if (error) errors[index] = error
      else if (question.type !== "file" && !isBlankSurveyAnswer(value)) answers[index] = typeof value === "string" ? value.trim() : value
    })
    current = nextSurveySection(survey, current, input)
  }
  return { answers, errors, visited }
}

export function displaySurveyAnswer(answer: SurveyAnswer | undefined, question?: SurveyQuestion): string {
  if (answer == null) return ""
  if (typeof answer === "string") return answer
  if (Array.isArray(answer)) return answer.join(", ")
  return Object.entries(answer).filter(([, value]) => !isBlankSurveyAnswer(value)).map(([row, value]) =>
    (question?.rows?.[Number(row)] ?? row) + ": " + (Array.isArray(value) ? value.join(", ") : value)
  ).join("; ")
}

export function encodeSurveyCsvRows(rows: string[][]) {
  const cell = (value: string) => '"' + (/^\s*[=+@-]|^[\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""') + '"'
  return rows.map((row) => row.map(cell).join(",")).join("\r\n")
}

export function surveyCsv(survey: SurveyDefinition, rows: { submittedAt: string; email?: string | null; answers: SurveyAnswer[] }[], includeHeader = true) {
  const withEmail = survey.settings?.collectEmail === true || rows.some((row) => row.email)
  return encodeSurveyCsvRows([
    ...(includeHeader ? [["Submitted at", ...(withEmail ? ["Email"] : []), ...survey.questions.map(({ label }) => label)]] : []),
    ...rows.map((row) => [new Date(row.submittedAt).toISOString(), ...(withEmail ? [row.email ?? ""] : []),
      ...survey.questions.map((question, index) => displaySurveyAnswer(row.answers[index], question))]),
  ])
}
