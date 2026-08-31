export type UserRole = "student" | "faculty" | "admin"

export const roleLabels: Record<UserRole, string> = {
  student: "Student",
  faculty: "Adviser",
  admin: "Admin",
}

export const rolePermissions: Record<UserRole, string[]> = {
  student: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/archive",
    "/dashboard/members",
    "/dashboard/advisers",
  ],
  faculty: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/roadmap",
    "/dashboard/backlog",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/archive",
    "/dashboard/members",
    "/dashboard/advisers",
  ],
  admin: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/archive",
    "/dashboard/members",
    "/dashboard/advisers",
  ],
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "student" || value === "faculty" || value === "admin"
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

export function canCreateProject(role: UserRole) {
  return role === "faculty" || role === "admin"
}
