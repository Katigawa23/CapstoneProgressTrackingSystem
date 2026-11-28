"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  choiceType, fileTypes, gridType, questionTypes,
  type QuestionType, type SurveyQuestion, type SurveySection,
} from "@/lib/task-survey"

export function moveSurveyItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [entry] = next.splice(from, 1)
  next.splice(to, 0, entry)
  return next
}

const selectClass = "min-h-11 min-w-0 max-w-full rounded-md border bg-background px-2 py-1 text-base sm:min-h-9 sm:text-sm"

function ItemList({ singular, items, onChange, branch, onRename }: {
  singular: string; items: string[]; onChange: (items: string[]) => void
  branch?: (option: string) => React.ReactNode; onRename?: (oldName: string, newName: string) => void
}) {
  return <fieldset className="min-w-0 space-y-2">
    <legend className="mb-1 text-sm font-medium">{singular}s</legend>
    {items.map((value, index) => (
      <div className="flex flex-wrap gap-1" key={index}>
        <Input className="w-full flex-1 basis-40" aria-label={singular + " " + (index + 1)} value={value} maxLength={160}
          onChange={(event) => {
            if (onRename) onRename(value, event.target.value)
            onChange(items.map((item, i) => i === index ? event.target.value : item))
          }} />
        {branch?.(value)}
        <Button type="button" size="sm" variant="ghost" aria-label={"Move " + singular.toLowerCase() + " " + (index + 1) + " up"}
          disabled={index === 0} onClick={() => onChange(moveSurveyItem(items, index, index - 1))}>↑</Button>
        <Button type="button" size="sm" variant="ghost" aria-label={"Move " + singular.toLowerCase() + " " + (index + 1) + " down"}
          disabled={index === items.length - 1} onClick={() => onChange(moveSurveyItem(items, index, index + 1))}>↓</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</Button>
      </div>
    ))}
    <Button type="button" size="sm" variant="outline" disabled={items.length >= 20}
      onClick={() => onChange([...items, singular + " " + (items.length + 1)])}>Add {singular.toLowerCase()}</Button>
  </fieldset>
}

export function SurveyQuestionEditor({ question, index, sections, onChange, move, duplicate, remove }: {
  question: SurveyQuestion; index: number; sections: SurveySection[]
  onChange: (update: Partial<SurveyQuestion>) => void
  move: (direction: number) => void; duplicate: () => void; remove: () => void
}) {
  const branchable = question.type === "choice" || question.type === "dropdown"
  const later = sections.slice(sections.findIndex(({ id }) => id === question.section) + 1)
  return <article className="min-w-0 space-y-3 rounded-lg border bg-background p-2.5 sm:p-4 max-sm:[&_button]:min-h-11 max-sm:[&_button]:min-w-11">
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
      <Input aria-label={"Question " + (index + 1)} placeholder="Enter a question" maxLength={240} value={question.label}
        onChange={(event) => onChange({ label: event.target.value })} />
      <select className={selectClass} aria-label={"Question " + (index + 1) + " type"} value={question.type}
        onChange={(event) => {
          const type = event.target.value as QuestionType
          onChange({ type, options: choiceType(type) || gridType(type) ? ["Option 1", "Option 2"] : undefined,
            rows: gridType(type) ? ["Row 1"] : undefined, branches: {}, other: false,
            allowedTypes: type === "file" ? ["application/pdf"] : undefined })
        }}>
        {Object.entries(questionTypes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select>
    </div>
    {choiceType(question.type) || gridType(question.type) ? (
      <ItemList singular={gridType(question.type) ? "Column" : "Option"} items={question.options ?? []}
        onChange={(options) => onChange({ options })}
        onRename={(old, next) => {
          const target = question.branches?.[old]
          if (target) onChange({ branches: { ...question.branches, [old]: "", [next]: target } })
        }}
        branch={branchable && later.length ? (option) => <select className={selectClass} aria-label={"After choosing " + option}
          value={question.branches?.[option] ?? ""} onChange={(event) => onChange({ branches: { ...question.branches, [option]: event.target.value } })}>
          <option value="">Continue to next section</option>
          {later.map((section) => <option value={section.id} key={section.id}>{section.title || "Section " + (sections.indexOf(section) + 1)}</option>)}
        </select> : undefined} />
    ) : null}
    {gridType(question.type) ? <ItemList singular="Row" items={question.rows ?? []} onChange={(rows) => onChange({ rows })} /> : null}
    {question.type === "choice" || question.type === "checks" ? <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={question.other === true} onChange={(event) => onChange({ other: event.target.checked })} />Allow an Other answer
    </label> : null}
    {question.type === "file" ? <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">Allowed file types</legend>
      <div className="flex flex-wrap gap-3">{Object.entries(fileTypes).map(([type, label]) => (
        <label key={type} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={question.allowedTypes?.includes(type) ?? false}
            onChange={(event) => onChange({ allowedTypes: event.target.checked ? [...(question.allowedTypes ?? []), type] : question.allowedTypes?.filter((entry) => entry !== type) })} />{label}
        </label>
      ))}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Maximum MB per file
          <select className={selectClass} value={question.maxSize ?? 1} onChange={(event) => onChange({ maxSize: Number(event.target.value) })}>
            {[1, 2, 3].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Maximum files
          <select className={selectClass} value={question.maxFiles ?? 1} onChange={(event) => onChange({ maxFiles: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">All attachments in one response must fit within 4 MB combined.</p>
    </fieldset> : null}
    {question.type === "scale" || question.type === "rating" ? <div className="grid gap-2 sm:grid-cols-2">
      {question.type === "scale" ? <label className="grid gap-1 text-sm">Start value
        <select className={selectClass} value={question.min ?? 1} onChange={(event) => onChange({ min: Number(event.target.value) })}><option>0</option><option>1</option></select>
      </label> : <label className="grid gap-1 text-sm">Rating icon
        <select className={selectClass} value={question.icon ?? "star"} onChange={(event) => onChange({ icon: event.target.value as SurveyQuestion["icon"] })}>
          <option value="star">Stars</option><option value="heart">Hearts</option><option value="thumb">Thumbs-up</option>
        </select>
      </label>}
      <label className="grid gap-1 text-sm">End value
        <select className={selectClass} value={question.max ?? 5} onChange={(event) => onChange({ max: Number(event.target.value) })}>
          {Array.from({ length: 9 }, (_, i) => i + 2).map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Start label<Input value={question.startLabel ?? ""} maxLength={80} onChange={(event) => onChange({ startLabel: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">End label<Input value={question.endLabel ?? ""} maxLength={80} onChange={(event) => onChange({ endLabel: event.target.value })} /></label>
    </div> : null}
    {question.type === "date" ? <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={question.includeTime === true} onChange={(event) => onChange({ includeTime: event.target.checked })} />Include the time
    </label> : null}
    {question.type === "time" ? <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={question.duration === true} onChange={(event) => onChange({ duration: event.target.checked })} />Record a duration
    </label> : null}
    <div className="flex flex-wrap items-center gap-2 border-t pt-2">
      <label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={question.required !== false}
        onChange={(event) => onChange({ required: event.target.checked })} />Required</label>
      {sections.length > 1 ? <select className={selectClass} aria-label={"Section for question " + (index + 1)}
        value={question.section ?? sections[0].id} onChange={(event) => onChange({ section: event.target.value, branches: {} })}>
        {sections.map((section, i) => <option key={section.id} value={section.id}>{section.title || "Section " + (i + 1)}</option>)}
      </select> : null}
      <Button type="button" size="sm" variant="ghost" aria-label={"Move question " + (index + 1) + " up"} onClick={() => move(-1)}>↑</Button>
      <Button type="button" size="sm" variant="ghost" aria-label={"Move question " + (index + 1) + " down"} onClick={() => move(1)}>↓</Button>
      <Button type="button" size="sm" variant="ghost" onClick={duplicate}>Duplicate</Button>
      <Button type="button" size="sm" variant="ghost" onClick={remove}>Delete</Button>
    </div>
  </article>
}
