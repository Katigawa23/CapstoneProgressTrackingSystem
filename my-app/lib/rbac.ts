export type UserRole = "student" | "faculty" | "admin"

export const roleLabels: Record<UserRole, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
}

export const rolePermissions: Record<UserRole, string[]> = {
  student: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/active-sprint",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/archive",
    "/dashboard/recycle-bin",
    "/dashboard/members",
    "/dashboard/adviser",
  ],
  faculty: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/active-sprint",
    "/dashboard/roadmap",
    "/dashboard/backlog",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/archive",
    "/dashboard/recycle-bin",
    "/dashboard/members",
    "/dashboard/adviser",
  ],
  admin: [
    "/dashboard",
    "/dashboard/board",
    "/dashboard/active-sprint",
    "/dashboard/roadmap",
    "/dashboard/revisions",
    "/dashboard/journal",
    "/dashboard/milestones",
    "/dashboard/backlog",
    "/dashboard/archive",
    "/dashboard/recycle-bin",
    "/dashboard/members",
    "/dashboard/adviser",
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
