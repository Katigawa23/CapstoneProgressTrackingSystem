"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PublicSurveyForm } from "@/app/survey/[token]/survey-form"
import {
  defaultSections, defaultSurveySettings, displaySurveyAnswer, questionTypes,
  readSurveyDefinition, type SurveyAnswer, type SurveyDefinition, type SurveySection, type SurveySettings,
} from "@/lib/task-survey"
import type { SurveyTally } from "@/lib/survey-tallies"
import { SurveyOverallChart, SurveyResponseChart } from "./survey-response-charts"
import { moveSurveyItem, SurveyQuestionEditor } from "./survey-question-editor"

type SurveyRecord = SurveyDefinition & { published: boolean; closed: boolean; token: string }
type SurveyState = {
  survey: SurveyRecord | null
  responses: { id: string; answers: SurveyAnswer[]; submittedAt: string; email: string | null;
    files: { id: string; questionIndex: number; name: string }[] }[]
  responseCount: number
  summary: SurveyTally[]
}

function newSurvey(): SurveyDefinition {
  return {
    title: "", purpose: "", questions: [{ label: "", type: "text", required: true, section: defaultSections[0].id }],
    sections: defaultSections, settings: defaultSurveySettings,
  }
}

export function TaskSurveyPanel({ taskId, surveyToken, canManage }: {
  taskId: string; surveyToken: string; canManage: boolean
}) {
  const endpoint = "/api/backlog-items/" + encodeURIComponent(taskId) + "/survey?survey=" + encodeURIComponent(surveyToken)
  const [data, setData] = useState<SurveyState>()
  const [draft, setDraft] = useState<SurveyDefinition>()
  const [preview, setPreview] = useState<SurveyDefinition>()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState("")
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState("questions")
  const [refresh, setRefresh] = useState(0)
  const [shareUrl, setShareUrl] = useState("")
  const [qr, setQr] = useState("")
  const saved = useRef("")
  const initialized = useRef(false)
  const savingTail = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(endpoint + "&page=" + page, { cache: "no-store", signal: controller.signal })
        if (response.status === 404) throw new Error("Survey task not found.")
        if (!response.ok) throw new Error("Could not load the survey.")
        const result: SurveyState = await response.json()
        if (controller.signal.aborted) return
        setData(result)
        if (canManage && !result.survey?.published && !initialized.current) {
          initialized.current = true
          const current = result.survey ?? newSurvey()
          saved.current = JSON.stringify(current)
          setDraft(current)
          setSaveStatus(result.survey ? "Draft saved" : "")
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load the survey.")
      }
    }
    void load()
    return () => controller.abort()
  }, [endpoint, page, refresh, canManage])

  const survey = data?.survey
  const token = survey?.published ? survey.token : undefined
  const responseCount = data?.responseCount
  useEffect(() => {
    if (!token) return
    let active = true
    const url = new URL("/survey/" + token, window.location.origin).href
    setShareUrl(url)
    void import("qrcode").then((module) => module.toDataURL(url, { width: 240 })).then((code) => {
      if (active) setQr(code)
    }).catch(() => {
      if (active) setError("Could not generate the QR code. The survey link is available.")
    })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if ((tab !== "responses" && tab !== "overall") || !token || preview) return
    const controller = new AbortController()
    let checking = false
    async function checkCount() {
      if (checking || document.visibilityState !== "visible") return
      checking = true
      try {
        const response = await fetch(endpoint + "&count=1", { cache: "no-store", signal: controller.signal })
        if (!response.ok) return
        const latest = await response.json()
        if (!controller.signal.aborted && latest.responseCount !== responseCount) setRefresh((current) => current + 1)
      } catch {
        // Retry on the next check. The last loaded results stay visible.
      } finally {
        checking = false
      }
    }
    const timer = window.setInterval(checkCount, 5000)
    document.addEventListener("visibilitychange", checkCount)
    void checkCount()
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", checkCount)
    }
  }, [tab, token, preview, endpoint, responseCount])

  const canEdit = canManage && Boolean(draft) && !survey?.published
  useEffect(() => {
    if (!canEdit || !draft || saving || preview) return
    const content = JSON.stringify(draft)
    if (saved.current === content) return
    setSaveStatus("Unsaved changes")
    let active = true
    const timer = setTimeout(() => {
      const work = savingTail.current.then(async () => {
        if (!active) return
        setSaveStatus("Saving draft…")
        try {
          const response = await fetch(endpoint, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, action: "draft" }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || "Draft could not be saved.")
          saved.current = content
          if (active) {
            setData(result)
            setSaveStatus("Draft saved")
          }
        } catch {
          if (active) setSaveStatus("Draft could not be saved. Edit or save again to retry.")
        }
      })
      savingTail.current = work
    }, 650)
    return () => { active = false; clearTimeout(timer) }
  }, [canEdit, draft, endpoint, preview, saving])

  async function save(action: "draft" | "publish" | "close" | "reopen") {
    if (saving) return
    const definition = action === "publish" ? readSurveyDefinition(draft) : action === "draft" ? readSurveyDefinition(draft, true) : undefined
    if ((action === "draft" || action === "publish") && !definition) {
      setError("Check the survey title, question settings, and section media.")
      return
    }
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await savingTail.current
      const response = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...definition }),
      })
      const result: SurveyState & { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error || "Could not save the survey.")
      setData(result)
      setPage(0)
      if (action === "draft") {
        saved.current = JSON.stringify(draft)
        setSaveStatus("Draft saved")
      } else {
        setMessage(action === "publish" ? "Survey published." : action === "close" ? "Submissions closed." : "Submissions reopened.")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the survey.")
    } finally { setSaving(false) }
  }

  function showPreview() {
    const copy = readSurveyDefinition(canEdit ? draft : survey)
    if (!copy) {
      setError("Complete the title, questions, and section settings before previewing.")
      return
    }
    setError("")
    setPreview(copy)
  }

  if (!data && !error) return <p role="status" className="text-sm text-muted-foreground">Loading survey?</p>
  if (!data) return <div className="space-y-2 border-t pt-3">
    <p role="alert" className="text-sm text-destructive">{error}</p>
    <Button type="button" size="sm" variant="outline" onClick={() => { setError(""); setRefresh((value) => value + 1) }}>Retry</Button>
  </div>
  if (preview) return <section className="space-y-3 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm">Preview · Test submissions are not saved.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setPreview(undefined)}>Back to survey</Button>
    </div>
    <PublicSurveyForm survey={preview} preview />
  </section>

  const shown = canEdit ? draft : survey
  const sections = shown?.sections ?? defaultSections
  const settings = shown?.settings ?? defaultSurveySettings
  function updateSection(index: number, update: Partial<SurveySection>) {
    setDraft((current) => current && { ...current, sections: sections.map((section, i) => index === i ? { ...section, ...update } : section) })
  }
  function updateSettings(update: Partial<SurveySettings>) {
    setDraft((current) => current && { ...current, settings: { ...settings, ...update } })
  }

  return <section className="min-w-0 space-y-3 border-t pt-3 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Survey</h4>
      <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:[&_button]:min-h-11">
        {canEdit ? <span role="status" className="text-xs text-muted-foreground">{saveStatus}</span> : null}
        {shown ? <Button type="button" size="sm" variant="outline" disabled={saving} onClick={showPreview}>Preview</Button> : null}
        {canEdit ? <>
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => save("draft")}>Save draft</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => save("publish")}>Publish</Button>
        </> : null}
      </div>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {survey?.published ? (
      <div className="rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-auto">{survey.closed ? "Submissions closed" : "Published"}</span>
          {shareUrl ? <a href={shareUrl} target="_blank" rel="noreferrer" className="underline">Open public survey</a> : null}
          {shareUrl ? <Button type="button" size="sm" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(shareUrl); setError(""); setMessage("Link copied.") }
            catch { setError("Open the survey and copy its address.") }
          }}>Copy link</Button> : null}
          {canManage ? <Button type="button" size="sm" variant="outline" disabled={saving}
            onClick={() => save(survey.closed ? "reopen" : "close")}>{survey.closed ? "Reopen submissions" : "Close submissions"}</Button> : null}
        </div>
        {qr && !survey.closed ? <a href={qr} download="survey-qr.png" className="mt-2 inline-flex flex-col gap-1 text-xs underline">
          <Image src={qr} alt="Public survey QR code" width={120} height={120} unoptimized />Download QR code
        </a> : null}
      </div>
    ) : null}
    {!shown ? <p className="text-xs text-muted-foreground">No questionnaire has been created yet.</p> : (
      <Tabs value={tab} onValueChange={(value) => {
        setTab(value)
        if (value === "responses" || value === "overall") setRefresh((current) => current + 1)
      }}>
        <TabsList aria-label="Survey workspace" className="grid min-h-[5.875rem] w-full grid-cols-2 sm:min-h-9 sm:grid-cols-4 max-sm:[&>button]:min-h-11">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="responses" onClick={() => setTab("responses")}>Responses</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="overall">Overall Results</TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="space-y-3">
          {canEdit ? <fieldset disabled={saving} className="space-y-3">
            <label className="grid gap-1 text-sm">Survey title
              <Input value={shown.title} maxLength={120} onChange={(event) => setDraft({ ...shown, title: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">Survey description
              <Textarea value={shown.purpose} maxLength={2000} onChange={(event) => setDraft({ ...shown, purpose: event.target.value })} />
            </label>
            {sections.map((section, sectionIndex) => <section key={section.id} aria-label={"Section " + (sectionIndex + 1)} className="min-w-0 space-y-2 rounded-lg border p-2.5 sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-sm font-semibold">Section {sectionIndex + 1}</h5>
                {sections.length > 1 ? <Button type="button" size="sm" variant="ghost" onClick={() => {
                  const remaining = sections.filter(({ id }) => id !== section.id)
                  setDraft({ ...shown, sections: remaining,
                    questions: shown.questions.map((question) => question.section === section.id ? { ...question, section: remaining[0].id, branches: {} } : question) })
                }}>Remove section</Button> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">Section heading<Input value={section.title} maxLength={120}
                  onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} /></label>
                <label className="grid gap-1 text-sm">Section description<Input value={section.description} maxLength={2000}
                  onChange={(event) => updateSection(sectionIndex, { description: event.target.value })} /></label>
                <label className="grid gap-1 text-sm">Image URL (HTTPS)<Input value={section.image ?? ""} maxLength={1000}
                  onChange={(event) => updateSection(sectionIndex, { image: event.target.value })} /></label>
                <label className="grid gap-1 text-sm">Video URL (YouTube or HTTPS MP4)<Input value={section.video ?? ""} maxLength={1000}
                  onChange={(event) => updateSection(sectionIndex, { video: event.target.value })} /></label>
              </div>
              {shown.questions.flatMap((question, index) => (question.section ?? sections[0].id) === section.id ? [
                <SurveyQuestionEditor key={index} question={question} index={index} sections={sections}
                  onChange={(update) => setDraft((current) => current && { ...current, questions: current.questions.map((entry, i) => i === index ? { ...entry, ...update } : entry) })}
                  move={(direction) => {
                    const siblingIndices = shown.questions.flatMap((entry, i) => (entry.section ?? sections[0].id) === section.id ? [i] : [])
                    const target = siblingIndices[siblingIndices.indexOf(index) + direction]
                    if (target !== undefined) setDraft({ ...shown, questions: moveSurveyItem(shown.questions, index, target) })
                  }}
                  duplicate={() => {
                    if (shown.questions.length >= 80) return
                    const questions = [...shown.questions]
                    questions.splice(index + 1, 0, { ...question })
                    setDraft({ ...shown, questions })
                  }}
                  remove={() => setDraft({ ...shown, questions: shown.questions.filter((_, i) => i !== index) })} />,
              ] : [])}
              <Button type="button" size="sm" variant="outline" disabled={shown.questions.length >= 80}
                onClick={() => setDraft({ ...shown, questions: [...shown.questions, { label: "", type: "text", required: true, section: section.id }] })}>Add question</Button>
            </section>)}
            <Button type="button" size="sm" variant="outline" disabled={sections.length >= 15}
              onClick={() => setDraft({ ...shown, sections: [...sections, { id: crypto.randomUUID(), title: "", description: "" }] })}>Add section</Button>
          </fieldset> : <div className="rounded-lg border p-3 text-sm">
            <h5 className="font-semibold">{shown.title}</h5>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{shown.purpose}</p>
            <ol className="mt-2 list-decimal pl-5">{shown.questions.map((question, index) =>
              <li key={index}>{question.label} <span className="text-muted-foreground">· {questionTypes[question.type]}</span></li>
            )}</ol>
          </div>}
        </TabsContent>
        <TabsContent value="responses" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h5 className="text-sm font-semibold">Results by question</h5>
              <p className="text-sm text-muted-foreground">{data.responseCount} total responses</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setRefresh((value) => value + 1)}>Refresh responses</Button>
            {survey ? <Button asChild size="sm" variant="outline"><a href={endpoint + "&export=csv"}>Export to CSV</a></Button> : null}
          </div>
          {survey ? <div className="min-w-0 space-y-3">
            {data.summary.map((tally, index) => <SurveyResponseChart key={index} tally={tally}
              question={survey.questions[index]} />)}
          </div> : null}
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-semibold">Individual submissions</h5>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button type="button" size="sm" variant="outline" disabled={(page + 1) * 20 >= data.responseCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
          {data.responses.map((response) => <details key={response.id} className="rounded border p-3 text-sm">
            <summary className="cursor-pointer"><time dateTime={response.submittedAt}>{new Date(response.submittedAt).toLocaleString()}</time>
              {response.email ? <span className="ml-2 break-all">{response.email}</span> : null}
            </summary>
            <dl className="mt-2 space-y-2">{survey?.questions.map((question, index) => (
              <div key={index}><dt className="font-medium">{question.label}</dt>
                <dd className="whitespace-pre-wrap break-words">{question.type === "file" ? (
                  response.files.filter((file) => file.questionIndex === index).map((file) =>
                    <a key={file.id} className="mr-2 underline" href={endpoint + "&file=" + file.id}>{file.name}</a>)
                ) : displaySurveyAnswer(response.answers[index], question) || "—"}</dd>
              </div>
            ))}</dl>
          </details>)}
        </TabsContent>
        <TabsContent value="settings" className="space-y-2">
          <fieldset disabled={!canEdit || saving} className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Response settings</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.collectEmail} onChange={(event) => updateSettings({ collectEmail: event.target.checked })} />Collect email addresses</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.requireSignIn}
              onChange={(event) => updateSettings({ requireSignIn: event.target.checked, limitOne: event.target.checked && settings.limitOne })} />Require Trachsphere sign-in</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.limitOne} disabled={!settings.requireSignIn}
              onChange={(event) => updateSettings({ limitOne: event.target.checked })} />Limit to one response per signed-in user</label>
            <label className="grid gap-1 text-sm">Confirmation message
              <Textarea value={settings.confirmation} maxLength={1000} onChange={(event) => updateSettings({ confirmation: event.target.value })} />
            </label>
          </fieldset>
        </TabsContent>
        <TabsContent value="overall">
          <SurveyOverallChart responseCount={data.responseCount} questions={shown.questions} tallies={data.summary} />
        </TabsContent>
      </Tabs>
    )}
  </section>
}
