"use client"

import Link from "next/link"
import { ChevronsUpDown, Folder, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DashboardProject } from "@/lib/projects"

type ProjectSwitcherProps = {
  displayName?: string
  onCreateProject: () => void
  onSelectProject: (projectId: string) => void
  projects: DashboardProject[]
  team: DashboardProject | null
}

export function ProjectSwitcher({
  displayName,
  onCreateProject,
  onSelectProject,
  projects,
  team,
}: ProjectSwitcherProps) {
  const teamName = displayName ?? team?.name ?? "Create project"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="
            group flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2
            text-left hover:bg-muted/60
            group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:flex-none
            group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl
            group-data-[collapsible=icon]:px-0
          "
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2972b6] shadow-sm">
            <Folder className="h-5 w-5 text-white" />
          </div>

          <div className="min-w-0 flex-1 self-center group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs text-muted-foreground">Project</div>
            <div className="truncate leading-tight text-sm font-semibold">{teamName}</div>
          </div>

          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} onClick={() => onSelectProject(project.id)}>
            {project.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">Our Project</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center justify-between"
          onSelect={(event) => {
            event.preventDefault()
            onCreateProject()
          }}
        >
          <span>Create project</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-sidebar-border">
            <Plus className="h-3 w-3" />
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
