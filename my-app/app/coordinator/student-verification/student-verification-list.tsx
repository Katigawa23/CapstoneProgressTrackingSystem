"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Filter, Loader2, Search, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { StudentVerification } from "@/lib/server-student-verification"

export function StudentVerificationList({ initialStudents }: { initialStudents: StudentVerification[] }) {
  const [students, setStudents] = React.useState(initialStudents)
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState("pending")
  const [courseFilter, setCourseFilter] = React.useState("all")
  const courses = [...new Set(students.map((student) => student.program))].sort((a, b) => a.localeCompare(b))
  const activeFilterCount = Number(courseFilter !== "all")
  const [review, setReview] = React.useState<{ student: StudentVerification; status: "approved" | "rejected" } | null>(null)
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const lock = React.useRef(false)
  const visible = students.filter((student) => (filter === "all" || student.status === filter) &&
    (courseFilter === "all" || student.program === courseFilter) &&
    [student.name, student.email, student.program].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())))

  React.useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch("/api/student-verification", { cache: "no-store", signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        setStudents(data.students)
      } catch { /* Keep the last successfully loaded list during a temporary outage. */ }
    }
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !lock.current) void refresh() }, 15000)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [])

  async function confirm() {
    if (!review || lock.current) return
    lock.current = true; setSaving(true); setError("")
    try {
      const response = await fetch("/api/student-verification", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: review.student.userId, status: review.status, reason }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save verification.")
      setStudents((current) => current.map((student) => student.userId === review.student.userId ? { ...student, status: review.status, reason: review.status === "rejected" ? reason.trim() : null } : student))
      setReview(null); setReason("")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save verification.") }
    finally { lock.current = false; setSaving(false) }
  }

  return <div className="space-y-5 pb-6">
    <Link href="/coordinator" className="text-sm text-muted-foreground hover:underline">Back to groups</Link>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-2xl font-semibold">Student Verification</h1><p className="mt-1 text-sm text-muted-foreground">Review new students in your assigned program before granting access.</p></div><div className="rounded-lg bg-[color:rgba(var(--brand-primary-rgb),0.1)] px-3 py-2 text-sm font-medium text-[var(--brand-primary-fixed)]">{students.filter((student) => student.status === "pending").length} pending</div></div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search students" placeholder="Search students..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
      <select aria-label="Verification status" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">{["all", "pending", "approved", "rejected"].map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status[0].toUpperCase() + status.slice(1)}</option>)}</select>
      <Popover>
        <PopoverTrigger asChild><Button variant="outline" className="gap-2"><Filter className="size-4" />Filter{activeFilterCount ? <span className="rounded bg-[color:rgba(var(--brand-primary-rgb),0.12)] px-1.5 py-0.5 text-[10px] text-[var(--brand-primary-fixed)]">{activeFilterCount}</span> : null}</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-4">
          <p className="text-sm font-semibold">Filter students</p>
          <div><label htmlFor="verification-course-filter" className="text-xs font-medium">Course</label><select id="verification-course-filter" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="all">All courses</option>{courses.map((course) => <option key={course} value={course}>{course}</option>)}</select></div>
          <Button variant="ghost" size="sm" disabled={!activeFilterCount} onClick={() => { setCourseFilter("all") }} className="w-full">Clear filters</Button>
        </PopoverContent>
      </Popover>
      {activeFilterCount ? <button type="button" onClick={() => { setCourseFilter("all") }} className="text-xs text-muted-foreground hover:underline">Clear filters</button> : null}
      <p aria-live="polite" className="text-xs text-muted-foreground sm:ml-auto">{visible.length} of {students.length} students</p>
    </div>
    <div className="overflow-hidden rounded-xl border bg-card dark:border-[#343434]">
      {visible.length ? <div className="divide-y">{visible.map((student) => <div key={student.userId} className="flex flex-wrap items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:rgba(var(--brand-primary-rgb),0.1)] text-[var(--brand-primary-fixed)]"><ShieldCheck className="size-4" /></div><div className="min-w-0"><p className="text-sm font-semibold">{student.name}</p><p className="break-all text-xs text-muted-foreground">{student.email}</p><p className="mt-2 text-xs">{student.program} · {student.yearLevel}</p><p className="mt-1 text-[11px] text-muted-foreground">Submitted {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(student.submittedAt))}</p>{student.reason ? <p className="mt-2 max-w-xl break-words text-xs text-red-500">{student.reason}</p> : null}</div></div><div className="flex items-center gap-2">{student.status === "pending" ? <><Button size="sm" variant="outline" onClick={() => { setError(""); setReason(""); setReview({ student, status: "rejected" }) }}><X className="size-3.5" />Reject</Button><Button size="sm" className="bg-[var(--brand-primary-fixed)] text-white" onClick={() => { setError(""); setReason(""); setReview({ student, status: "approved" }) }}><Check className="size-3.5" />Approve</Button></> : <span className={`rounded-full border px-2.5 py-1 text-xs ${student.status === "approved" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-red-500/25 bg-red-500/10 text-red-500"}`}>{student.status === "approved" ? "Approved" : "Rejected"}</span>}</div></div>)}</div> : <div className="p-12 text-center text-sm text-muted-foreground">No {filter === "all" ? "matching" : filter} student requests.</div>}
    </div>
    <Dialog open={review !== null} onOpenChange={(open) => { if (!open && !saving) setReview(null) }}>
      <DialogContent showCloseButton={!saving} onEscapeKeyDown={(event) => { if (saving) event.preventDefault() }} onInteractOutside={(event) => { if (saving) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{review?.status === "approved" ? "Approve student?" : "Reject verification?"}</DialogTitle><DialogDescription>{review?.student.name}{review?.status === "approved" ? " will be allowed to access TrackSphere. Confirm that their details match your official student records." : " will remain unable to access the dashboard. Explain what they need to correct."}</DialogDescription></DialogHeader>
        {review?.status === "rejected" ? <div><label htmlFor="verification-reason" className="text-sm font-medium">Reason</label><textarea id="verification-reason" maxLength={1000} disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-md border bg-background p-3 text-sm" placeholder="Enter the reason for rejection..." /></div> : null}
        {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setReview(null)}>Cancel</Button><Button disabled={saving || (review?.status === "rejected" && !reason.trim())} onClick={() => void confirm()} className="bg-[var(--brand-primary-fixed)] text-white">{saving ? <Loader2 className="size-4 animate-spin" /> : null}{review?.status === "approved" ? "Approve student" : "Reject request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
