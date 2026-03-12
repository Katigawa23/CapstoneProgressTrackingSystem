"use client"

import * as React from "react"

import {
  cacheDashboardProjects,
  createDashboardProject,
  getDashboardProjects,
  getDashboardProject,
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
    const memberName = memberSearch.trim()

    if (!title || !description || !memberName) {
      return null
    }

    const nextProject = await createDashboardProject({
      name: title,
      description,
      members: [getInitials(memberName)],
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
  }, [memberSearch, projectDescription, projectTitle, resetCreateProjectForm])

  return {
    createProject,
    createProjectOpen,
    memberSearch,
    projectDescription,
    projectTitle,
    projects,
    resetCreateProjectForm,
    selectProject,
    setCreateProjectOpen,
    setMemberSearch,
    setProjectDescription,
    setProjectTitle,
    team,
  }
}
