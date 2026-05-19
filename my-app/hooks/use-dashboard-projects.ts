"use client"

import * as React from "react"

import { readClientAuthSession, type AuthenticatedUser } from "@/lib/auth-client"
import {
  cacheDashboardProjects,
  createDashboardProject,
  getDashboardProjects,
  getDashboardProject,
  getSelectedDashboardProjectId,
  OTHER_PROJECT_OPTION,
  PROJECT_CHANGE_EVENT,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
  type DashboardProject,
} from "@/lib/projects"
import { validateDisplayName } from "@/lib/text-validation"

export type ProjectMemberOption = {
  id: string
  email: string
  name: string
  role: string
  canCreateSprint: boolean
}

function normalizeMemberIdentity(value: string) {
  return value.trim().toLowerCase()
}

function isCurrentUserMemberOption(
  member: ProjectMemberOption,
  currentUser: AuthenticatedUser | null | undefined
) {
  if (!currentUser) {
    return false
  }

  const currentUserId = normalizeMemberIdentity(currentUser.id)
  const currentUserEmail = normalizeMemberIdentity(currentUser.email)
  const memberId = normalizeMemberIdentity(member.id)
  const memberEmail = normalizeMemberIdentity(member.email)

  return (
    (currentUserId.length > 0 && memberId === currentUserId) ||
    (currentUserEmail.length > 0 && memberEmail === currentUserEmail)
  )
}

function canViewMemberOption(
  member: ProjectMemberOption,
  currentUser: AuthenticatedUser | null | undefined
) {
  if (currentUser?.role !== "faculty") {
    return true
  }

  return member.role === "student"
}

export function useDashboardProjects({
  initialProjects = [],
  initialTeam = null,
}: {
  initialProjects?: DashboardProject[]
  initialTeam?: DashboardProject | null
} = {}) {
  const [projects, setProjects] = React.useState<DashboardProject[]>(initialProjects)
  const [team, setTeam] = React.useState<DashboardProject | null>(initialTeam)
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
  const [projectTitle, setProjectTitle] = React.useState("")
  const [projectProgram, setProjectProgram] = React.useState("")
  const [projectProgramOther, setProjectProgramOther] = React.useState("")
  const [projectYearLevel, setProjectYearLevel] = React.useState("")
  const [projectYearLevelOther, setProjectYearLevelOther] = React.useState("")
  const [projectSyTerm, setProjectSyTerm] = React.useState("")
  const [projectSyTermOther, setProjectSyTermOther] = React.useState("")
  const [projectType, setProjectType] = React.useState("")
  const [projectTypeOther, setProjectTypeOther] = React.useState("")
  const [memberSearch, setMemberSearch] = React.useState("")
  const [memberOptions, setMemberOptions] = React.useState<ProjectMemberOption[]>([])
  const [memberOptionsLoading, setMemberOptionsLoading] = React.useState(false)
  const [selectedMembers, setSelectedMembers] = React.useState<ProjectMemberOption[]>([])
  const [isCreatingProject, setIsCreatingProject] = React.useState(false)
  const [createProjectError, setCreateProjectError] = React.useState<string | null>(null)
  const latestMemberRequestId = React.useRef(0)

  const syncProjectState = React.useCallback(() => {
    const savedProjectId = getSelectedDashboardProjectId()
    setProjects(getDashboardProjects())
    setTeam(getDashboardProject(savedProjectId) ?? null)
  }, [])

  React.useEffect(() => {
    cacheDashboardProjects(initialProjects)
    const cachedProjects = getDashboardProjects()
    const savedProjectId = getSelectedDashboardProjectId()
    setProjects(cachedProjects)
    setTeam(
      cachedProjects.find((project) => project.id === savedProjectId) ??
        initialTeam ??
        cachedProjects[0] ??
        null
    )

    window.addEventListener("storage", syncProjectState)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProjectState)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjectState)

    return () => {
      window.removeEventListener("storage", syncProjectState)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProjectState)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjectState)
    }
  }, [initialProjects, initialTeam, syncProjectState])

  React.useEffect(() => {
    let active = true

    void refreshDashboardProjects()
      .then((nextProjects) => {
        if (!active) {
          return
        }

        setProjects(nextProjects)
        const savedProjectId = getSelectedDashboardProjectId()
        setTeam((currentTeam) =>
          nextProjects.find((project) => project.id === savedProjectId) ??
          (currentTeam
            ? nextProjects.find((project) => project.id === currentTeam.id) ?? null
            : null) ??
          nextProjects[0] ??
          null
        )
      })
      .catch((error) => {
        console.error("Failed to refresh projects", error)
      })

    return () => {
      active = false
    }
  }, [])

  const resetCreateProjectForm = React.useCallback(() => {
    setProjectTitle("")
    setProjectProgram("")
    setProjectProgramOther("")
    setProjectYearLevel("")
    setProjectYearLevelOther("")
    setProjectSyTerm("")
    setProjectSyTermOther("")
    setProjectType("")
    setProjectTypeOther("")
    setMemberSearch("")
    setMemberOptions([])
    setSelectedMembers([])
    setCreateProjectError(null)
  }, [])

  React.useEffect(() => {
    if (!createProjectOpen) {
      return
    }

    const controller = new AbortController()
    const requestId = latestMemberRequestId.current + 1
    latestMemberRequestId.current = requestId
    const timeoutId = window.setTimeout(async () => {
      try {
        setMemberOptionsLoading(true)

        const response = await fetch(
          `/api/registered-users?q=${encodeURIComponent(memberSearch.trim())}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          throw new Error("Failed to load registered users")
        }

        const data = (await response.json()) as { users?: ProjectMemberOption[] }
        if (latestMemberRequestId.current !== requestId) {
          return
        }

        const currentUser = readClientAuthSession()?.user ?? null
        setMemberOptions(
          Array.isArray(data.users)
            ? data.users.filter(
                (member) =>
                  !isCurrentUserMemberOption(member, currentUser) &&
                  canViewMemberOption(member, currentUser)
              )
            : []
        )
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        console.error("Failed to load registered users", error)
        if (latestMemberRequestId.current === requestId) {
          setMemberOptions([])
        }
      } finally {
        if (latestMemberRequestId.current === requestId) {
          setMemberOptionsLoading(false)
        }
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [createProjectOpen, memberSearch])

  const handleMemberSearchChange = React.useCallback((value: string) => {
    setMemberSearch(value)
  }, [])

  const handleMemberSelect = React.useCallback((member: ProjectMemberOption) => {
    const currentUser = readClientAuthSession()?.user

    if (
      isCurrentUserMemberOption(member, currentUser) ||
      !canViewMemberOption(member, currentUser)
    ) {
      setMemberSearch("")
      return
    }

    setSelectedMembers((currentMembers) => {
      if (currentMembers.some((currentMember) => currentMember.id === member.id)) {
        return currentMembers
      }

      return [
        ...currentMembers,
        member,
      ]
    })
    setMemberSearch("")
  }, [])

  const handleMemberRemove = React.useCallback((memberId: string) => {
    setSelectedMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId)
    )
  }, [])

  const handleProjectTitleChange = React.useCallback((value: string) => {
    setCreateProjectError(null)
    setProjectTitle(value)
  }, [])

  const selectProject = React.useCallback(
    (projectId: string) => {
      const nextProject = projects.find((project) => project.id === projectId) ?? null
      setDashboardProject(projectId)
      setTeam(nextProject)
      return nextProject
    },
    [projects]
  )

  const createProject = React.useCallback(async () => {
    if (isCreatingProject) {
      return null
    }

    const title = projectTitle.trim()
    const program =
      (projectProgram === OTHER_PROJECT_OPTION ? projectProgramOther : projectProgram).trim()
    const yearLevel =
      (projectYearLevel === OTHER_PROJECT_OPTION ? projectYearLevelOther : projectYearLevel).trim()
    const syTerm =
      (projectSyTerm === OTHER_PROJECT_OPTION ? projectSyTermOther : projectSyTerm).trim()
    const resolvedProjectType =
      (projectType === OTHER_PROJECT_OPTION ? projectTypeOther : projectType).trim()
    const memberNames = selectedMembers
      .filter((member) => member.role === "student")
      .map((member) => member.name.trim())
      .filter(Boolean)
    const adviserNames = selectedMembers
      .filter((member) => member.role === "faculty")
      .map((member) => member.name.trim())
      .filter(Boolean)
    const memberUserIds = selectedMembers
      .filter((member) => member.role === "student")
      .map((member) => member.id.trim())
      .filter(Boolean)
    const memberAccess = selectedMembers
      .map((member) => ({
        userId: member.id.trim(),
        role: member.role,
        canCreateSprint: false,
      }))
      .filter((member) => member.userId)

    if (!title || !program || !yearLevel || !syTerm || !resolvedProjectType || memberNames.length === 0) {
      return null
    }

    const titleValidationError = validateDisplayName(title, "Project title")

    if (titleValidationError) {
      setCreateProjectError(titleValidationError)
      return null
    }

    let nextProject: DashboardProject

    try {
      setIsCreatingProject(true)
      setCreateProjectError(null)
      nextProject = await createDashboardProject({
        name: title,
        members: memberNames,
        advisers: adviserNames,
        memberUserIds,
        memberAccess,
        program,
        yearLevel,
        syTerm,
        projectType: resolvedProjectType,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create project"
      setCreateProjectError(message)
      return null
    } finally {
      setIsCreatingProject(false)
    }

    setDashboardProject(nextProject.id)
    const nextProjects = [
      nextProject,
      ...getDashboardProjects().filter((project) => project.id !== nextProject.id),
    ]

    cacheDashboardProjects(nextProjects)
    setProjects(nextProjects)
    setTeam(nextProject)
    setCreateProjectOpen(false)
    resetCreateProjectForm()

    return nextProject
  }, [
    isCreatingProject,
    projectProgram,
    projectProgramOther,
    projectSyTerm,
    projectSyTermOther,
    projectTitle,
    projectType,
    projectTypeOther,
    projectYearLevel,
    projectYearLevelOther,
    resetCreateProjectForm,
    selectedMembers,
  ])

  return {
    createProject,
    createProjectOpen,
    createProjectError,
    isCreatingProject,
    handleMemberSearchChange,
    handleMemberRemove,
    handleMemberSelect,
    handleProjectTitleChange,
    memberSearch,
    memberOptions,
    memberOptionsLoading,
    projectProgram,
    projectProgramOther,
    projectSyTerm,
    projectSyTermOther,
    projectTitle,
    projectType,
    projectTypeOther,
    projectYearLevel,
    projectYearLevelOther,
    projects,
    resetCreateProjectForm,
    selectedMembers,
    selectProject,
    setCreateProjectOpen,
    setProjectProgram,
    setProjectProgramOther,
    setProjectSyTerm,
    setProjectSyTermOther,
    setProjectType,
    setProjectTypeOther,
    setProjectYearLevel,
    setProjectYearLevelOther,
    team,
  }
}
