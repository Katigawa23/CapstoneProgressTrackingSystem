"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { Heart, Star, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  defaultSections, defaultSurveySettings, fileTypes, gridType, isSurveyEmail, maxSurveyBytes,
  nextSurveySection, surveyAnswerError, type SurveyAnswer, type SurveyDefinition, type SurveyQuestion,
} from "@/lib/task-survey"

const optionClass = "flex min-h-11 min-w-0 cursor-pointer items-center gap-2 py-1.5 text-sm"
const optionInputClass = "size-4 shrink-0 accent-primary"

function AnswerField({ question, value, files, onChange, onFiles }: {
  question: SurveyQuestion; value: SurveyAnswer; files: File[]
  onChange: (value: SurveyAnswer) => void; onFiles: (files: File[]) => void
}) {
  const id = useId()
  const text = typeof value === "string" ? value : ""
  const options = question.options ?? []
  const selectClass = "min-h-11 w-full min-w-0 max-w-full rounded-md border bg-background p-2 text-base sm:text-sm"
  if (question.type === "paragraph") return <Textarea aria-label={question.label} value={text} onChange={(event) => onChange(event.target.value)} maxLength={2000} />
  if (question.type === "dropdown") return <select aria-label={question.label} className={selectClass} value={text} onChange={(event) => onChange(event.target.value)}>
    <option value="">Choose an option</option>{options.map((option) => <option key={option}>{option}</option>)}
  </select>
  if (question.type === "file") return <div className="space-y-2">
    <Input id={id + "-file"} aria-label={question.label} className="min-h-11 min-w-0 max-w-full" type="file" multiple={(question.maxFiles ?? 1) > 1} accept={question.allowedTypes?.join(",")}
      onChange={(event) => onFiles(Array.from(event.target.files ?? []))} />
    <p className="text-xs text-muted-foreground">Up to {question.maxFiles} file(s), {question.maxSize} MB each. {question.allowedTypes?.map((type) => fileTypes[type as keyof typeof fileTypes]).join(", ")}.</p>
    {files.length ? <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs"><span className="min-w-0 [overflow-wrap:anywhere]">{files.map((file) => file.name).join(", ")}</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => {
        onFiles([])
        const input = document.getElementById(id + "-file")
        if (input instanceof HTMLInputElement) input.value = ""
      }}>Remove files</Button></div> : null}
  </div>
  if (question.type === "choice" || question.type === "checks") {
    const multiple = question.type === "checks"
    const current = Array.isArray(value) ? value : text ? [text] : []
    const other = current.find((entry) => entry.startsWith("Other: "))
    const update = (option: string, active: boolean) => onChange(multiple
      ? active ? [...current, option] : current.filter((entry) => entry !== option)
      : option)
    return <div className="space-y-2">
      {options.map((option) => <label key={option} className={optionClass}>
        <input className={optionInputClass} type={multiple ? "checkbox" : "radio"} name={id} checked={current.includes(option)}
          onChange={(event) => update(option, event.target.checked)} /><span className="min-w-0 [overflow-wrap:anywhere]">{option}</span>
      </label>)}
      {question.other ? <label className={optionClass}>
        <input className={optionInputClass} type={multiple ? "checkbox" : "radio"} name={id} checked={other !== undefined}
          onChange={(event) => update(other ?? "Other: ", event.target.checked)} /> Other
      </label> : null}
      {other !== undefined ? <Input aria-label="Other answer" maxLength={480} value={other.slice(7)}
        onChange={(event) => {
          const next = "Other: " + event.target.value
          onChange(multiple ? [...current.filter((entry) => entry !== other), next] : next)
        }} /> : null}
    </div>
  }
  if (gridType(question.type)) {
    const grid = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    const single = question.type === "grid"
    return <div className="space-y-2">
      {question.rows?.map((row, index) => <fieldset key={row} className="min-w-0 rounded border p-2">
        <legend className="max-w-full px-1 text-sm font-medium [overflow-wrap:anywhere]">{row}</legend>
        <div className="grid min-w-0 gap-x-4 sm:flex sm:flex-wrap">
          {options.map((option) => {
            const selected = grid[index]
            const group = Array.isArray(selected) ? selected : []
            return <label key={option} className={optionClass}>
              <input className={optionInputClass} type={single ? "radio" : "checkbox"} name={id + "-" + index}
                checked={single ? selected === option : group.includes(option)}
                onChange={(event) => onChange({ ...grid, [index]: single ? option : event.target.checked ? [...group, option] : group.filter((entry) => entry !== option) })} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{option}</span>
            </label>
          })}
        </div>
      </fieldset>)}
    </div>
  }
  if (question.type === "rating" || question.type === "scale") {
    const min = question.min ?? 1
    const max = question.max ?? 5
    const Icon = question.icon === "heart" ? Heart : question.icon === "thumb" ? ThumbsUp : Star
    return <div className="space-y-1">
      <div className="flex flex-wrap gap-2">{Array.from({ length: max - min + 1 }, (_, index) => min + index).map((score) => (
        <label key={score} className="relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-md border px-2 has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-2">
          <input type="radio" name={id} className="sr-only" aria-label={String(score)} checked={text === String(score)} onChange={() => onChange(String(score))} />
          {question.type === "rating" ? <span className="flex items-center gap-1"><Icon size={16} aria-hidden />{score}</span> : score}
        </label>
      ))}</div>
      {question.startLabel || question.endLabel ? <div className="flex justify-between gap-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"><span>{question.startLabel}</span><span>{question.endLabel}</span></div> : null}
    </div>
  }
  if (question.type === "time" && question.duration) return <Input aria-label={question.label} placeholder="Hours:minutes:seconds (e.g. 1:30:00)"
    maxLength={9} value={text} onChange={(event) => onChange(event.target.value)} />
  const type = question.type === "date" ? question.includeTime ? "datetime-local" : "date" : question.type === "time" ? "time" : "text"
  return <Input className="min-h-11 min-w-0 max-w-full" aria-label={question.label} type={type} maxLength={1000} value={text} onChange={(event) => onChange(event.target.value)} />
}

export function PublicSurveyForm({ token, survey, signedIn = false, preview = false }: {
  token?: string; survey: SurveyDefinition; signedIn?: boolean; preview?: boolean
}) {
  const sections = survey.sections ?? defaultSections
  const settings = survey.settings ?? defaultSurveySettings
  const [path, setPath] = useState([sections[0].id])
  const [answers, setAnswers] = useState<SurveyAnswer[]>(() => survey.questions.map(() => null))
  const [files, setFiles] = useState(new Map<number, File[]>())
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [emailError, setEmailError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const submission = useRef("")
  const section = sections.find(({ id }) => id === path.at(-1)) ?? sections[0]
  const indices = survey.questions.flatMap((question, index) => (question.section ?? sections[0].id) === section.id ? [index] : [])
  const next = nextSurveySection(survey, section.id, answers)
  const asksEmail = settings.collectEmail && !signedIn
  const sectionHeading = useRef<HTMLHeadingElement>(null)
  function goTo(steps: string[]) {
    setPath(steps)
    setError("")
    setErrors({})
    requestAnimationFrame(() => sectionHeading.current?.focus())
  }

  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || confirmation) return
    const invalid: Record<number, string> = {}
    for (const index of indices) {
      const issue = surveyAnswerError(survey.questions[index], answers[index], files.get(index))
      if (issue) invalid[index] = issue
    }
    const invalidEmail = path.length === 1 && asksEmail && !isSurveyEmail(email.trim())
    setErrors(invalid)
    setEmailError(invalidEmail)
    setError("")
    if (invalidEmail || Object.keys(invalid).length) return
    if (next) { goTo([...path, next]); return }
    if (!consent) { setError("Confirm consent before submitting."); return }
    if (preview) { setConfirmation(settings.confirmation); return }
    setSaving(true)
    try {
      const key = "tracksphere-survey-" + token
      submission.current ||= sessionStorage.getItem(key) || crypto.randomUUID()
      sessionStorage.setItem(key, submission.current)
      const data = new FormData()
      const activeFiles = [...files].filter(([index]) => path.includes(survey.questions[index].section ?? sections[0].id))
      if (activeFiles.flatMap(([, entries]) => entries).reduce((total, file) => total + file.size, 0) >= maxSurveyBytes) {
        throw new Error("Keep all attachments under 4 MB combined.")
      }
      data.set("response", JSON.stringify({ submissionId: submission.current, consent, email, answers }))
      for (const [index, entries] of activeFiles) for (const file of entries) data.append("file-" + index, file)
      const response = await fetch("/api/surveys/" + token, { method: "POST", body: data })
      const result = await response.json()
      if (!response.ok) {
        if (result.errors || result.emailError) {
          const first = result.emailError ? sections[0].id
            : survey.questions[Number(Object.keys(result.errors)[0])]?.section ?? sections[0].id
          const position = path.indexOf(first)
          if (position >= 0) goTo(path.slice(0, position + 1))
          setErrors(result.errors ?? {})
          setEmailError(Boolean(result.emailError))
        }
        throw new Error(result.error || "Could not save your response.")
      }
      setConfirmation(result.confirmation ?? settings.confirmation)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your response.")
    } finally { setSaving(false) }
  }

  if (confirmation) return <p role="status" className="whitespace-pre-wrap rounded-lg border bg-card p-5">{confirmation}</p>
  return (
    <form onSubmit={advance} className="w-full min-w-0 space-y-5 rounded-xl border bg-card p-3 [overflow-wrap:anywhere] sm:p-6" noValidate>
      <div>
        <h1 className="text-2xl font-semibold">{survey.title}</h1>
        {survey.purpose ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{survey.purpose}</p> : null}
        {path.length === 1 && settings.requireSignIn ? <p className="mt-2 text-sm text-muted-foreground">
          {settings.limitOne ? "One response per signed-in account." : "Sign-in is required for this survey."}
        </p> : null}
      </div>
      <section className="space-y-3">
        <h2 ref={sectionHeading} tabIndex={-1} className="font-semibold outline-none">
          {section.title || (sections.length > 1 ? "Section " + (sections.findIndex(({ id }) => id === section.id) + 1) : "Questions")}
        </h2>
        {section.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{section.description}</p> : null}
        {section.image ? <img src={section.image} alt={section.title || "Survey illustration"} loading="lazy" referrerPolicy="no-referrer" className="max-h-80 w-full rounded object-contain" /> : null}
        {section.video?.startsWith("https://www.youtube-nocookie.com/embed/") ? (
          <iframe className="aspect-video w-full rounded" title={section.title || "Survey video"} src={section.video} loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" allowFullScreen />
        ) : section.video ? <video controls preload="none" src={section.video} className="max-h-80 w-full rounded" /> : null}
      </section>
      {asksEmail && path.length === 1 ? <label className="block space-y-1 text-sm">
        <span>Email address <span className="text-destructive">*</span></span>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        {emailError ? <span role="alert" className="text-destructive">Enter a valid email address.</span> : null}
      </label> : null}
      {indices.map((index) => {
        const question = survey.questions[index]
        return <fieldset key={index} className="min-w-0 space-y-2 rounded-lg border p-3">
          <legend className="max-w-full break-words px-1 text-sm font-medium">
            {question.label}{question.required !== false ? <span className="ml-1 text-destructive" aria-label="required">*</span> : null}
          </legend>
          <AnswerField question={question} value={answers[index]} files={files.get(index) ?? []}
            onChange={(value) => setAnswers((current) => current.map((old, i) => index === i ? value : old))}
            onFiles={(selected) => setFiles((current) => new Map(current).set(index, selected))} />
          {errors[index] ? <p role="alert" className="text-sm text-destructive">{errors[index]}</p> : null}
        </fieldset>
      })}
      {!next ? <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
        I agree to share these answers with the research group and its adviser for the purpose described above.
      </label> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {path.length > 1 ? <Button type="button" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={saving} onClick={() => goTo(path.slice(0, -1))}>Back</Button> : null}
        <Button type="submit" className="min-h-11 flex-1 sm:flex-none" disabled={saving}>{saving ? "Submitting…" : next ? "Next" : preview ? "Test submit" : "Submit response"}</Button>
      </div>
    </form>
  )
}
