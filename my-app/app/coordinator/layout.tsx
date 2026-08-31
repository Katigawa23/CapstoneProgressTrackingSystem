import { redirect } from "next/navigation"

import { DashboardLayoutShell } from "@/app/(dashboard)/dashboard/layout-shell"
import { readAuthenticatedUser } from "@/lib/server-auth"

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const user = await readAuthenticatedUser()

  if (!user) redirect("/")
  if (user.id !== "tester-coordinator") redirect("/dashboard")

  return (
    <DashboardLayoutShell
      coordinatorMode
      initialAuthSession={{
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        tenantId: user.tenantId,
        expiresAt: new Date(user.expiresAt).toISOString(),
      }}
      initialProjects={[]}
      initialTeam={null}
    >
      {children}
    </DashboardLayoutShell>
  )
}
