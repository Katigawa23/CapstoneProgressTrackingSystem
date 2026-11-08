"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Loader2, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog as DialogPrimitive } from "radix-ui"

export function StudentProfileSetup({ name, email, programs, yearLevels, initialProfile }: {
  name: string; email: string; programs: string[]; yearLevels: string[]; initialProfile?: { program: string; yearLevel: string }
}) {
  const router = useRouter()
  const savingRef = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [program, setProgram] = React.useState(initialProfile?.program ?? "")
  const [yearLevel, setYearLevel] = React.useState(initialProfile?.yearLevel ?? "")
  const [retryAt, setRetryAt] = React.useState<string | null>(null)
  const [usedAttempts, setUsedAttempts] = React.useState<number | null>(null)
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    const refreshAttempts = async () => {
      if (savingRef.current || document.visibilityState !== "visible") return
      try {
        const response = await fetch("/api/student-profile", { cache: "no-store", signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (savingRef.current) return
        setUsedAttempts(data.submissionLimit?.used ?? 0)
        setRetryAt(data.submissionLimit?.retryAt ?? null)
      } catch { /* Retain the last confirmed count if the connection is interrupted. */ }
    }
    void refreshAttempts()
    window.addEventListener("focus", refreshAttempts)
    document.addEventListener("visibilitychange", refreshAttempts)
    const quotaTimer = window.setInterval(refreshAttempts, 15000)
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { controller.abort(); window.clearInterval(timer); window.clearInterval(quotaTimer); window.removeEventListener("focus", refreshAttempts); document.removeEventListener("visibilitychange", refreshAttempts) }
  }, [])
  const submissionLocked = retryAt !== null && Date.parse(retryAt) > now
  const unavailable = !programs.length || !yearLevels.length

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current || submissionLocked) return
    savingRef.current = true
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/student-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ program, yearLevel }) })
      const data = await response.json()
      if (response.status === 429 && data.retryAt) { setRetryAt(data.retryAt); setUsedAttempts(5) }
      if (!response.ok) throw new Error(data.error || "Could not save your profile.")
      setUsedAttempts((used) => Math.min(5, (used ?? 0) + 1))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your profile. Please try again.")
      savingRef.current = false
      setSaving(false)
    }
  }

  return <DialogPrimitive.Root open>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md" />
      <DialogPrimitive.Content onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-4 shadow-2xl outline-none sm:p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
      <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-[color:rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-primary-fixed)]"><GraduationCap className="size-5" /></div>
      <DialogPrimitive.Title className="font-display text-lg font-semibold">Complete your student profile</DialogPrimitive.Title>
      <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">Welcome to TrackSphere. Add your academic details to continue.</DialogPrimitive.Description>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div><label htmlFor="student-name" className="text-xs font-medium">Full name</label><Input id="student-name" value={name} readOnly className="mt-1 h-8 bg-muted/40 text-xs" /><p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="size-3" />From your signed-in account</p><p className="mt-1 break-all text-xs text-muted-foreground">{email}</p></div>
        <fieldset disabled={saving} className="space-y-3 disabled:opacity-60">
          <div><label htmlFor="student-program" className="text-xs font-medium">Course / program <span className="text-red-500">*</span></label><select id="student-program" required value={program} onChange={(event) => setProgram(event.target.value)} className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"><option value="">Select your course</option>{programs.map((label) => <option key={label} value={label}>{label}</option>)}</select></div>
          <div className="space-y-3">
            <div><label htmlFor="student-year" className="text-xs font-medium">Year level <span className="text-red-500">*</span></label><select id="student-year" required value={yearLevel} onChange={(event) => setYearLevel(event.target.value)} className="mt-1 h-8 w-full rounded-md border bg-background px-2.5 text-xs"><option value="">Select year level</option>{yearLevels.map((label) => <option key={label} value={label}>{label}</option>)}</select></div>
          </div>
        </fieldset>
        {usedAttempts !== null && usedAttempts > 0 ? <div aria-live="polite" className="rounded-lg border bg-muted/20 p-3 text-xs">
          <p className="font-semibold">{Math.max(0, 5 - usedAttempts)} of 5 attempts remaining</p>
          <p className="mt-1 text-muted-foreground">Each successful submission uses 1 attempt. Attempts become available again 24 hours after they were used.</p>
        </div> : null}
        {submissionLocked && retryAt ? <p role="status" className="text-xs text-amber-600 dark:text-amber-400">Submission limit reached. You can submit again on {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(retryAt))} (Philippine time).</p> : null}
        {unavailable ? <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">Please ask your administrator to add course and year-level options.</p> : null}
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <Button type="submit" disabled={saving || submissionLocked || unavailable || !program || !yearLevel} className="h-8 w-full text-xs bg-[var(--brand-primary-fixed)] text-white hover:bg-[var(--brand-primary-fixed)]/90">{saving ? <><Loader2 className="size-4 animate-spin" />Saving...</> : "Save and continue"}</Button>
      </form>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
}
