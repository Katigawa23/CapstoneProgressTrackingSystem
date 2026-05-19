export type StatusOption = {
  value: string
  label: string
  color: string
}

export type AssigneeOption = {
  id: string
  name: string
  email?: string
  initials?: string
}

export type WorkItem = {
  id: string
  displayId: string
  orderIndex: number
  parentId?: string | null
  title: string
  startDate?: Date
  dueDate?: Date
  description: string
  status: string
  checked: boolean
  assigneeId?: string | null
  priority?: "Low" | "Medium" | "High"
}

export const statusOptions: StatusOption[] = [
  {
    value: "todo",
    label: "Todo",
    color: "border-blue-200 bg-blue-100 text-blue-700",
  },
  {
    value: "inprogress",
    label: "In Progress",
    color: "border-yellow-200 bg-yellow-100 text-yellow-700",
  },
  {
    value: "revision",
    label: "Revision",
    color: "border-orange-200 bg-orange-100 text-orange-700",
  },
  {
    value: "completed",
    label: "Completed",
    color: "border-green-200 bg-green-100 text-green-700",
  },
]

export let assigneeOptions: AssigneeOption[] = [
  {
    id: "kerby",
    name: "Kerby Bryan Morte (Assign to me)",
    email: "kerbybryanm@gmail.com",
    initials: "KM",
  },
]

export function buildAssigneeOptionId(name: string) {
  const normalizedName = name.trim().toLowerCase()

  if (!normalizedName) {
    return "member"
  }

  const slug = normalizedName
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "member"
}

function buildAssigneeOption(
  name: string,
  currentUser?: { id?: string | null; name?: string | null; email?: string | null } | null,
  explicitId?: string | null
) {
  const trimmedName = name.trim()
  const currentUserName = currentUser?.name?.trim() ?? ""
  const currentUserEmail = currentUser?.email?.trim() ?? ""
  const currentUserId = currentUser?.id?.trim() ?? ""
  const isCurrentUser = Boolean(currentUserName) && trimmedName === currentUserName

  return {
    id: isCurrentUser && currentUserId ? currentUserId : explicitId || buildAssigneeOptionId(trimmedName),
    name: isCurrentUser ? "Assign to me" : trimmedName,
    email: isCurrentUser ? currentUserEmail || undefined : undefined,
    initials: trimmedName
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  }
}

export function createAssigneeOptionsFromNames(
  names: string[],
  currentUser?: { id?: string | null; name?: string | null; email?: string | null; role?: string | null } | null
) {
  const uniqueNames = Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter(Boolean)
    )
  )

  const currentUserName = currentUser?.name?.trim() ?? ""
  const canAssignSelf = currentUser?.role === "student"

  if (currentUserName && canAssignSelf && !uniqueNames.includes(currentUserName)) {
    uniqueNames.unshift(currentUserName)
  }

  return uniqueNames
    .filter((name) => canAssignSelf || name !== currentUserName)
    .map((name) => buildAssigneeOption(name, currentUser))
}

export function createAssigneeOptionsFromProject(
  project:
    | {
        members?: string[]
        memberUserIds?: string[]
      }
    | null
    | undefined,
  currentUser?: { id?: string | null; name?: string | null; email?: string | null; role?: string | null } | null
) {
  const memberNames = (project?.members ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
  const memberUserIds = (project?.memberUserIds ?? []).map((id) => id.trim())
  const currentUserName = currentUser?.name?.trim() ?? ""
  const currentUserId = currentUser?.id?.trim() ?? ""
  const canAssignSelf = currentUser?.role === "student"

  const options = memberNames.flatMap((name, index) => {
    if (!canAssignSelf && name === currentUserName) {
      return []
    }

    const mappedId = memberUserIds[index]
    const resolvedId =
      currentUserName && name === currentUserName && currentUserId
        ? currentUserId
        : mappedId

    if (!resolvedId) {
      return []
    }

    return [buildAssigneeOption(name, currentUser, resolvedId)]
  })

  if (
    canAssignSelf &&
    currentUserName &&
    !options.some((option) => option.id === currentUserId || option.name === currentUserName)
  ) {
    options.unshift(
      buildAssigneeOption(
        currentUserName,
        currentUser,
        currentUserId || buildAssigneeOptionId(currentUserName)
      )
    )
  }

  return options
}

export function setAssigneeOptions(options: AssigneeOption[]) {
  assigneeOptions = options.length > 0 ? options : []
}

export function getStatusOption(value: string) {
  return statusOptions.find((option) => option.value === value) ?? statusOptions[0]
}

export function getAssigneeOption(value?: string | null) {
  if (!value) return null
  return assigneeOptions.find((option) => option.id === value) ?? null
}
