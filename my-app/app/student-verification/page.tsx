import { getDb } from "@/lib/server-db"
import { ensureCoordinatorAssignmentSchema } from "@/lib/server-coordinator-assignments"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock3, ShieldCheck, TriangleAlert } from "lucide-react"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getStudentAccessState, getStudentSubmissionLimit } from "@/lib/server-student-profile"
import { VerificationRefresh } from "./verification-refresh"

export const dynamic = "force-dynamic"

export default async function StudentVerificationWaitingPage() {
  const user = await readAuthenticatedUser(true)
  if (!user) redirect("/")
  if (user.role !== "student") redirect("/dashboard")
  const access = await getStudentAccessState(user.id)
  if (!access.required || access.status === "approved") redirect("/dashboard")
  if (!access.profileComplete) redirect("/dashboard")
  await ensureCoordinatorAssignmentSchema()
  const coordinator = await getDb().query<{ name: string }>(`
    select u.name from student_profiles p
    join program_coordinator_assignments a on a.program_option_id=p.program_option_id
    join users u on u.microsoft_user_id=a.faculty_user_id
    where p.user_id=$1 limit 1`, [user.id])
  const coordinatorName = coordinator.rows[0]?.name
  const submissionLimit = await getStudentSubmissionLimit(user.id)
  const rejected = access.status === "rejected"
  const Icon = rejected ? TriangleAlert : Clock3
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5">
    <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm dark:border-[#343434]">
      <p className="font-display text-xl font-bold">Track<span className="text-[var(--brand-primary-fixed)]">Sphere</span></p>
      <div className="mt-6 flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><Icon className="size-5" /></div>
      <h1 className="mt-3 text-xl font-semibold">{rejected ? "Verification needs attention" : "Pending verification"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{rejected ? "Your coordinator could not approve your details. Review the reason below and update your profile." : "Your profile has been sent to your program coordinator. You can enter the dashboard once your account is approved."}</p>
      <div className="mt-5 space-y-2 rounded-lg border bg-muted/20 p-3 text-sm"><p className="font-medium">{user.name}</p><p className="break-all text-xs text-muted-foreground">{user.email}</p><p>{access.program}</p><p className="text-muted-foreground">{access.yearLevel}</p></div>
      {rejected ? <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm"><p className="font-medium">Coordinator&apos;s reason</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{access.reason}</p></div> : <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Only your assigned program coordinator can approve your account.</p>}
      {rejected ? <Link href="/student-profile" className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-md bg-[var(--brand-primary-fixed)] text-sm font-medium text-white">Update details and resubmit</Link> : null}
      {!rejected ? <div className="mt-4 rounded-lg border p-3 text-sm"><p className="font-medium">Request status: Pending</p><p className="mt-1 text-muted-foreground">{coordinatorName ? `Your request is in the ${access.program} verification queue for ${coordinatorName}. If you changed your course, your request moves to that course's coordinator.` : `No coordinator is assigned to ${access.program} yet. Your request is saved as Pending. Ask your administrator to assign a coordinator to this program.`}</p></div> : null}
      <p className="mt-4 text-sm font-medium">{Math.max(0, 5 - submissionLimit.used)} of 5 submission attempts remaining</p>
      {submissionLimit.retryAt ? <p className="mt-1 text-xs text-muted-foreground">Next attempt available: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(submissionLimit.retryAt))} (Philippine time).</p> : null}
      <VerificationRefresh />
    </section>
  </main>
}
