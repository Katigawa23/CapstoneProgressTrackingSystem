import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getFacultyAccessState } from "@/lib/server-faculty-verification"
import { VerificationRefresh } from "@/app/student-verification/verification-refresh"
export const dynamic = "force-dynamic"
export default async function FacultyWaitingPage() {
  const user = await readAuthenticatedUser(true)
  if (!user) redirect("/")
  if (user.role !== "faculty") redirect("/dashboard")
  const access = await getFacultyAccessState(user.id)
  if (access.status === "approved") redirect("/dashboard")
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5"><section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
    <p className="font-display text-xl font-bold">TrackSphere</p>
    <h1 className="mt-6 text-xl font-semibold">{access.status === "rejected" ? "Verification rejected" : "Pending faculty verification"}</h1>
    <p className="mt-2 text-sm text-muted-foreground">The superadmin must verify your faculty account before you can access the dashboard or be assigned as an adviser or coordinator.</p>
    <div className="mt-5 rounded-lg border p-3 text-sm"><p>{user.name}</p><p className="break-all text-muted-foreground">{user.email}</p></div>
    {access.reason ? <p className="mt-4 whitespace-pre-wrap break-words text-sm text-red-500">{access.reason}</p> : null}
    {access.status === "rejected" ? <p className="mt-3 text-sm text-muted-foreground">Contact your superadmin to confirm your eligibility.</p> : null}
    <VerificationRefresh />
  </section></main>
}
