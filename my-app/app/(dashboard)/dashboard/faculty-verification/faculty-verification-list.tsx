"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVerificationBulkActions } from "@/components/verification-bulk-actions"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FacultyVerification } from "@/lib/server-faculty-verification"

export function FacultyVerificationList({ initialFaculty }: { initialFaculty: FacultyVerification[] }) {
  const [faculty, setFaculty] = React.useState(initialFaculty)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState("pending")
  const [review, setReview] = React.useState<{ student: FacultyVerification; status: "approved" | "rejected" | "revoked" | "restore" } | null>(null)
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const lock = React.useRef(false)
  const requestVersion = React.useRef(0)
  const visible = faculty.filter((student) => (filter === "all" || student.status === filter) &&
    [student.name, student.email].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())))

  React.useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      const version = ++requestVersion.current
      try {
        const response = await fetch("/api/faculty-verification", { cache: "no-store", signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (!lock.current && version === requestVersion.current) setFaculty(data.faculty)
      } catch { /* Keep the last successfully loaded list during a temporary outage. */ }
    }
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !lock.current) void refresh() }, 15000)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [])

  async function confirm() {
    if (!review || lock.current) return
    lock.current = true; requestVersion.current++; setSaving(true); setError("")
    try {
      const response = await fetch("/api/faculty-verification", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facultyId: review.student.userId, status: review.status, reason }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save verification.")
      setFaculty((current) => current.map((student) => student.userId === review.student.userId ? { ...student, status: review.status === "restore" ? "approved" : review.status, reason: review.status === "rejected" ? reason.trim() : null } : student))
      setReview(null); setReason("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save verification.") }
    finally { lock.current = false; setSaving(false) }
  }

  const bulk = useVerificationBulkActions({
    accounts: visible,
    filter,
    saving,
    kind: "faculty",
    begin: () => {
      if (lock.current || review) return false
      lock.current = true
      requestVersion.current++
      setSaving(true)
      return true
    },
    finish: () => {
      lock.current = false
      setSaving(false)
    },
    onSaved: (ids, status) => setFaculty((current) => current.map((account) =>
      ids.has(account.userId) ? { ...account, status, reason: null } : account
    )),
  })

  return <div className="space-y-5 pb-6">
    <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">Back to dashboard</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-2xl font-semibold">Faculty Verification</h1><p className="mt-1 text-sm text-muted-foreground">Verify faculty accounts before granting access to TrackSphere.</p></div><div className="rounded-lg bg-[color:rgba(var(--brand-primary-rgb),0.1)] px-3 py-2 text-sm font-medium text-[var(--brand-primary-fixed)]">{faculty.filter((student) => student.status === "pending").length} pending</div></div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search faculty" placeholder="Search faculty..." value={search} onChange={(event) => { bulk.clearSelection(); setSearch(event.target.value) }} className="pl-9" /></div>
      <select aria-label="Verification status" value={filter} onChange={(event) => { bulk.clearSelection(); setFilter(event.target.value) }} className="h-9 rounded-md border bg-background px-3 text-sm">{["all", "pending", "approved", "rejected", "revoked"].map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status[0].toUpperCase() + status.slice(1)}</option>)}</select>
      <p aria-live="polite" className="text-xs text-muted-foreground sm:ml-auto">{visible.length} of {faculty.length} faculty</p>
    </div>
    {bulk.controls}
    <div className="overflow-hidden rounded-xl border bg-card dark:border-[var(--border)]">
      {bulk.toolbar}
      {visible.length ? <div className="divide-y">{visible.map((student) => <div key={student.userId} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-start gap-3">{bulk.checkbox(student)}<div className="min-w-0"><p className="text-sm font-semibold">{student.name}</p><p className="break-all text-xs text-muted-foreground">{student.email}</p><p className="mt-1 text-[11px] text-muted-foreground">Submitted {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(student.submittedAt))}</p>{student.reason ? <p className="mt-2 max-w-xl break-words text-xs text-red-500">{student.reason}</p> : null}</div></div><div className="flex items-center gap-2">{student.status === "pending" ? <><Button size="sm" variant="outline" onClick={() => { setError(""); setReason(""); setReview({ student, status: "rejected" }) }}><X className="size-3.5" />Reject</Button><Button size="sm" className="bg-[var(--brand-primary-fixed)] text-white" onClick={() => { setError(""); setReason(""); setReview({ student, status: "approved" }) }}><Check className="size-3.5" />Approve</Button></> : <><span className={`rounded-full border px-2.5 py-1 text-xs ${student.status === "approved" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-red-500/25 bg-red-500/10 text-red-500"}`}>{student.status === "approved" ? "Approved" : student.status === "revoked" ? "Revoked" : "Rejected"}</span></>}</div></div>)}</div> : <div className="p-12 text-center text-sm text-muted-foreground">No {filter === "all" ? "matching" : filter} faculty requests.</div>}
    </div>
    <Dialog open={review !== null} onOpenChange={(open) => { if (!open && !saving) setReview(null) }}>
      <DialogContent showCloseButton={!saving} onEscapeKeyDown={(event) => { if (saving) event.preventDefault() }} onInteractOutside={(event) => { if (saving) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{review?.status === "revoked" ? "Revoke access?" : review?.status === "restore" ? "Restore access?" : review?.status === "approved" ? "Approve faculty?" : "Reject verification?"}</DialogTitle><DialogDescription>{review?.student.name}{review?.status === "revoked" ? " will be signed out and lose access to TrackSphere. Their work history will be kept." : review?.status === "restore" ? " will regain access to TrackSphere." : review?.status === "approved" ? " will be allowed to access TrackSphere. Confirm that their details match your official faculty records." : " will remain unable to access the dashboard. Explain what they need to correct."}</DialogDescription></DialogHeader>
        {review?.status === "rejected" ? <div><label htmlFor="verification-reason" className="text-sm font-medium">Reason</label><textarea id="verification-reason" maxLength={1000} disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm" placeholder="Enter the reason for rejection..." /></div> : null}
        {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setReview(null)}>Cancel</Button><Button disabled={saving || (review?.status === "rejected" && !reason.trim())} onClick={() => void confirm()} className="bg-[var(--brand-primary-fixed)] text-white">{saving ? <Loader2 className="size-4 animate-spin" /> : null}{review?.status === "revoked" ? "Revoke access" : review?.status === "restore" ? "Restore access" : review?.status === "approved" ? "Approve faculty" : "Reject request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
