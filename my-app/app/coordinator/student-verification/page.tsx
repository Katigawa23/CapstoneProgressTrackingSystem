import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { isAssignedCoordinator, listAssignedCoordinatorProgramLabels } from "@/lib/server-coordinator-assignments"
import { listStudentVerifications } from "@/lib/server-student-verification"
import { StudentVerificationList } from "./student-verification-list"

export const dynamic = "force-dynamic"

export default async function StudentVerificationPage() {
  const user = await readAuthenticatedUser()
  if (!user) redirect("/")
  if (user.role !== "faculty" || !await isAssignedCoordinator(user.id)) redirect("/dashboard")
  const programs = await listAssignedCoordinatorProgramLabels(user.id)
  return <StudentVerificationList key={`${user.id}:${programs.join("|")}`} initialStudents={await listStudentVerifications(user.id, user.tenantId)} />
}
