export type UserRole = "student" | "adviser" | "admin"

export const roleLabels: Record<UserRole, string> = {
  student: "Student",
  adviser: "Adviser",
  admin: "Admin",
}

export const rolePermissions: Record<UserRole, string[]> = {
  student: [
    "/dashboard",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/history",
    "/dashboard/members",
    "/dashboard/adviser",
  ],
  adviser: [
    "/dashboard",
    "/dashboard/roadmap",
    "/dashboard/backlog",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/history",
    "/dashboard/members",
    "/dashboard/adviser",
  ],
  admin: [
    "/dashboard",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/history",
    "/dashboard/members",
    "/dashboard/adviser",
  ],
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "student" || value === "adviser" || value === "admin"
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const normalizedPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname

  return rolePermissions[role].some((allowedPath) => {
    if (normalizedPath === allowedPath) {
      return true
    }

    return normalizedPath.startsWith(`${allowedPath}/`)
  })
}
