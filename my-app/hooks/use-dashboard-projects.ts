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
  const [projectDescription, setProjectDescription] = React.useState("")
  const [projectProgram, setProjectProgram] = React.useState("")
  const [projectProgramOther, setProjectProgramOther] = React.useState("")
  const [projectYearLevel, setProjectYearLevel] = React.useState("")
  const [projectYearLevelOther, setProjectYearLevelOther] = React.useState("")
  const [projectSyTerm, setProjectSyTerm] = React.useState("")
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
    setProjectDescription("")
    setProjectProgram("")
    setProjectProgramOther("")
    setProjectYearLevel("")
    setProjectYearLevelOther("")
    setProjectSyTerm("")
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
    const description = projectDescription.trim()
    const program =
      (projectProgram === OTHER_PROJECT_OPTION ? projectProgramOther : projectProgram).trim()
    const yearLevel = projectYearLevel.trim()
    const syTerm = projectSyTerm.trim()
    const resolvedProjectType =
      (projectType === OTHER_PROJECT_OPTION ? projectTypeOther : projectType).trim()
    const memberName = memberSearch.trim()

    if (!title || !description || !program || !yearLevel || !syTerm || !resolvedProjectType || !memberName) {
      return null
    }

    const nextProject = await createDashboardProject({
      name: title,
      description,
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
    projectDescription,
    projectProgram,
    projectProgramOther,
    projectSyTerm,
    projectTitle,
    projectType,
    projectTypeOther,
    projectYearLevel,
    resetCreateProjectForm,
  ])

  return {
    createProject,
    createProjectOpen,
    memberSearch,
    projectDescription,
    projectProgram,
    projectProgramOther,
    projectSyTerm,
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
    setProjectDescription,
    setProjectProgram,
    setProjectProgramOther,
    setProjectSyTerm,
    setProjectTitle,
    setProjectType,
    setProjectTypeOther,
    setProjectYearLevel,
    setProjectYearLevelOther,
    team,
  }
}
