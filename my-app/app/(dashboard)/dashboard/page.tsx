import { getDashboardHomeData } from "./data"
import { DashboardPageClient } from "./page-client"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { projects, activities } = await getDashboardHomeData()

  return (
    <DashboardPageClient
      initialProjects={projects}
      initialActivities={activities}
    />
  )
}
