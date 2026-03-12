"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import {
  type DashboardProject,
  getDashboardProjects,
  PROJECTS_CHANGE_EVENT,
  refreshDashboardProjects,
  setDashboardProject,
} from "@/lib/projects"

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState<DashboardProject[]>([])

  React.useEffect(() => {
    const syncProjects = () => {
      setProjects(getDashboardProjects())
    }

    syncProjects()
    void refreshDashboardProjects()
      .then((nextProjects) => {
        setProjects(nextProjects)
      })
      .catch((error) => {
        console.error("Failed to refresh projects", error)
      })

    window.addEventListener("storage", syncProjects)
    window.addEventListener(PROJECTS_CHANGE_EVENT, syncProjects)

    return () => {
      window.removeEventListener("storage", syncProjects)
      window.removeEventListener(PROJECTS_CHANGE_EVENT, syncProjects)
    }
  }, [])

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-auto pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a project</h1>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new project from the sidebar menu to start your thesis workspace.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="relative flex min-h-[180px] w-full max-w-[260px] flex-col overflow-hidden border-border/60 bg-card pt-0 shadow-sm"
          >
            <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />

            <CardHeader className="flex-1 space-y-3 px-5 pt-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center">
                  {project.members.map((member, index) => (
                    <Avatar
                      key={`${project.id}-${member}`}
                      className={`h-7 w-7 border-2 border-background ${
                        index === 0 ? "" : "-ml-2"
                      }`}
                    >
                      <AvatarFallback className="text-xs">{member}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>

                <Badge variant="secondary" className="text-[11px]">
                  {project.members.length} members
                </Badge>
              </div>
            </CardContent>

            <CardFooter className="mt-auto px-5 pt-2 pb-4">
              <Button
                className="h-9 w-full justify-between"
                onClick={() => {
                  setDashboardProject(project.id)
                  router.push("/dashboard/board")
                }}
              >
                Open board
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
