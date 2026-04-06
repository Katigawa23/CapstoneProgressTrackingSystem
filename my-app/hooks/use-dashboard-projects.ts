"use client"

import * as React from "react"

import {
  cacheDashboardProjects,
  createDashboardProject,
  getDashboardProjects,
  getDashboardProject,
  OTHER_PROJECT_OPTION,
  PROJECT_CHANGE_EVENT,
  PROJECTS_CHANGE_EVENT,
  PROJECT_STORAGE_KEY,
  refreshDashboardProjects,
  setDashboardProject,
  type DashboardProject,
} from "@/lib/projects"

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function useDashboardProjects() {
  const [projects, setProjects] = React.useState<DashboardProject[]>([])
  const [team, setTeam] = React.useState<DashboardProject | null>(null)
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

  const syncProjectState = React.useCallback(() => {
    const savedProjectId = window.localStorage.getItem(PROJECT_STORAGE_KEY)
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
    const memberName = memberSearch.trim()

    if (!title || !program || !yearLevel || !syTerm || !resolvedProjectType || !memberName) {
      return null
    }

    const nextProject = await createDashboardProject({
      name: title,
      members: [getInitials(memberName)],
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
    memberSearch,
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
  ])

  return {
    createProject,
    createProjectOpen,
    memberSearch,
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
    selectProject,
    setCreateProjectOpen,
    setMemberSearch,
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
