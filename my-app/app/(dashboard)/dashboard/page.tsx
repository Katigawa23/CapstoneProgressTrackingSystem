import { getDashboardHomeData } from "./data"
import { DashboardPageClient } from "./page-client"
import { redirect } from "next/navigation"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { isAssignedCoordinator } from "@/lib/server-coordinator-assignments"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await readAuthenticatedUser()
  if (user?.id && (user.id === "tester-coordinator" || await isAssignedCoordinator(user.id))) {
    redirect("/coordinator")
  }
  const { projects, activities } = await getDashboardHomeData()

  return (
    <DashboardPageClient
      initialProjects={projects}
      initialActivities={activities}
    />
  )
}
