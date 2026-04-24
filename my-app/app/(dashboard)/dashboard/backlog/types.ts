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

export function createAssigneeOptionsFromNames(
  names: string[],
  currentUser?: { id?: string | null; name?: string | null; email?: string | null } | null
) {
  const uniqueNames = Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter(Boolean)
    )
  )

  const currentUserName = currentUser?.name?.trim() ?? ""
  const currentUserEmail = currentUser?.email?.trim() ?? ""

  if (currentUserName && !uniqueNames.includes(currentUserName)) {
    uniqueNames.unshift(currentUserName)
  }

  return uniqueNames.map((name) => ({
    id:
      name === currentUserName && currentUser?.id?.trim()
        ? currentUser.id.trim()
        : buildAssigneeOptionId(name),
    name,
    email: name === currentUserName ? currentUserEmail || undefined : undefined,
    initials: name
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  }))
}

export function createAssigneeOptionsFromProject(
  project:
    | {
        members?: string[]
        memberUserIds?: string[]
      }
    | null
    | undefined,
  currentUser?: { id?: string | null; name?: string | null; email?: string | null } | null
) {
  const memberNames = (project?.members ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
  const memberUserIds = (project?.memberUserIds ?? []).map((id) => id.trim())
  const currentUserName = currentUser?.name?.trim() ?? ""
  const currentUserEmail = currentUser?.email?.trim() ?? ""
  const currentUserId = currentUser?.id?.trim() ?? ""

  const options = memberNames.map((name, index) => {
    const fallbackId = buildAssigneeOptionId(name)
    const mappedId = memberUserIds[index] || fallbackId
    const resolvedId =
      currentUserName && name === currentUserName && currentUserId
        ? currentUserId
        : mappedId

    return {
      id: resolvedId,
      name,
      email: currentUserName && name === currentUserName ? currentUserEmail || undefined : undefined,
      initials: name
        .split(/\s+/)
        .map((part) => part[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    }
  })

  if (
    currentUserName &&
    !options.some((option) => option.id === currentUserId || option.name === currentUserName)
  ) {
    options.unshift({
      id: currentUserId || buildAssigneeOptionId(currentUserName),
      name: currentUserName,
      email: currentUserEmail || undefined,
      initials: currentUserName
        .split(/\s+/)
        .map((part) => part[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    })
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
