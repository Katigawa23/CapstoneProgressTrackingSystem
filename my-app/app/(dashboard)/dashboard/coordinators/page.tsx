import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { CoordinatorManagement } from "./coordinator-management"

export default async function CoordinatorsPage() {
  const user = await readAuthenticatedUser()
  if (user?.id !== "tester-admin") redirect("/dashboard")
  return <CoordinatorManagement />
}
