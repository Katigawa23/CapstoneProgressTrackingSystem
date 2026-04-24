"use client"

import * as React from "react"

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

export type ProjectMemberOption = {
  id: string
  email: string
  name: string
  role: string
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
  const latestMemberRequestId = React.useRef(0)

  const syncProjectState = React.useCallback(() => {
    const savedProjectId = getSelectedDashboardProjectId()
    setProjects(getDashboardProjects())
    setTeam(getDashboardProject(savedProjectId) ?? null)
  }, [])

  React.useEffect(() => {
    syncProjectState()
    window.addEventListener("storage", syncProjectState)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProjectState)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjectState)

    return () => {
      window.removeEventListener("storage", syncProjectState)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProjectState)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjectState)
    }
  }, [syncProjectState])

  React.useEffect(() => {
    let active = true

    void refreshDashboardProjects()
      .then((nextProjects) => {
        if (!active) {
          return
        }

        setProjects(nextProjects)
        setTeam((currentTeam) =>
          currentTeam
            ? nextProjects.find((project) => project.id === currentTeam.id) ?? nextProjects[0] ?? null
            : nextProjects[0] ?? null
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

        setMemberOptions(Array.isArray(data.users) ? data.users : [])
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
    setSelectedMembers((currentMembers) => {
      if (currentMembers.some((currentMember) => currentMember.id === member.id)) {
        return currentMembers
      }

      return [...currentMembers, member]
    })
    setMemberSearch("")
  }, [])

  const handleMemberRemove = React.useCallback((memberId: string) => {
    setSelectedMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId)
    )
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
      .map((member) => member.name.trim())
      .filter(Boolean)
    const memberUserIds = selectedMembers
      .map((member) => member.id.trim())
      .filter(Boolean)

    if (!title || !program || !yearLevel || !syTerm || !resolvedProjectType || memberNames.length === 0) {
      return null
    }

    const nextProject = await createDashboardProject({
      name: title,
      members: memberNames,
      memberUserIds,
      program,
      yearLevel,
      syTerm,
      projectType: resolvedProjectType,
    })

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
    handleMemberSearchChange,
    handleMemberRemove,
    handleMemberSelect,
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
    setProjectTitle,
    setProjectType,
    setProjectTypeOther,
    setProjectYearLevel,
    setProjectYearLevelOther,
    team,
  }
}
