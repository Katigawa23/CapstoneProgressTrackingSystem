import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getStudentAccessState } from "@/lib/server-student-profile"
import { listProjectConfigurationOptions } from "@/lib/server-project-configuration"
import { StudentProfileSetup } from "../(dashboard)/dashboard/components/student-profile-setup"

export const dynamic = "force-dynamic"

export default async function StudentProfilePage() {
  const user = await readAuthenticatedUser(true)
  if (!user) redirect("/")
  if (user.role !== "student") redirect("/dashboard")
  const access = await getStudentAccessState(user.id)
  if (!access.required || access.status === "approved") redirect("/dashboard")
  if (access.status === "pending") redirect("/student-verification")
  const options = await listProjectConfigurationOptions()
  return <main className="min-h-dvh bg-background"><StudentProfileSetup name={user.name} email={user.email} initialProfile={{ program: access.program ?? "", yearLevel: access.yearLevel ?? "" }} programs={options.filter((o) => o.category === "program").map((o) => o.label)} yearLevels={options.filter((o) => o.category === "year_level").map((o) => o.label)} /></main>
}
