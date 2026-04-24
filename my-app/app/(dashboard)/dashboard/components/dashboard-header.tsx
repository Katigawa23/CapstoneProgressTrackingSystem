"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getDashboardProject,
  getSelectedDashboardProjectId,
  PROJECT_CHANGE_EVENT,
} from "@/lib/projects"
import { getInitials } from "../utils"

type Person = {
  name: string
  src: string
}

type DashboardHeaderProps = {
  people: Person[]
  onCreate?: () => void
}

export function DashboardHeader({ people, onCreate }: DashboardHeaderProps) {
  const [projectName, setProjectName] = React.useState("No project selected")
  const visiblePeople = people.slice(0, 3)
  const hiddenCount = Math.max(people.length - visiblePeople.length, 0)

  React.useEffect(() => {
    const syncProject = () => {
      const savedProjectId = getSelectedDashboardProjectId()
      setProjectName(getDashboardProject(savedProjectId)?.name ?? "No project selected")
    }

    syncProject()
    window.addEventListener("storage", syncProject)
    window.addEventListener(PROJECT_CHANGE_EVENT, syncProject)

    return () => {
      window.removeEventListener("storage", syncProject)
      window.removeEventListener(PROJECT_CHANGE_EVENT, syncProject)
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        Project / <span className="text-foreground">{projectName}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">Board</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="sm"
            className="min-h-8 self-start hover:opacity-90 sm:self-auto"
            style={{
              backgroundColor: "var(--brand-primary-fixed)",
              color: "var(--brand-primary-fixed-foreground)",
            }}
            onClick={onCreate}
          >
            Create
          </Button>

          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-full pl-8 text-xs" placeholder="Search" />
          </div>

          <div className="flex items-center">
            {visiblePeople.map((person, index) => (
              <Avatar
                key={person.name}
                title={person.name}
                className={`h-7 w-7 ring-2 ring-background ${
                  index === 0 ? "" : "-ml-2"
                }`}
              >
                <AvatarImage src={person.src} alt={person.name} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            ))}

            {hiddenCount > 0 ? (
              <Avatar className="h-7 w-7 ring-2 ring-background -ml-2" title={`${hiddenCount} more members`}>
                <AvatarFallback className="text-[10px]">+{hiddenCount}</AvatarFallback>
              </Avatar>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
