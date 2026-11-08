import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { listFacultyVerifications } from "@/lib/server-faculty-verification"
import { FacultyVerificationList } from "./faculty-verification-list"
export const dynamic = "force-dynamic"
export default async function FacultyVerificationPage() {
  const user = await readAuthenticatedUser()
  if (user?.id !== "tester-admin" || user.role !== "admin") redirect("/dashboard")
  return <FacultyVerificationList initialFaculty={await listFacultyVerifications(user.tenantId)} />
}
