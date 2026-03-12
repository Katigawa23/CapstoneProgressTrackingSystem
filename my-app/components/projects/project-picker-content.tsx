"use client"

import { FolderOpen } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { DashboardProject, DashboardProjectCollection } from "@/lib/projects"

type ProjectPickerContentProps = {
  collections: DashboardProjectCollection[]
  onSelectProject: (projectId: string) => void
  projects: DashboardProject[]
  team: DashboardProject | null
}

export function ProjectPickerContent({
  collections,
  onSelectProject,
  projects,
  team,
}: ProjectPickerContentProps) {
  if (projects.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-sm text-muted-foreground">
            No projects yet. Create your first project from the project menu above.
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      {collections.map((collection) => {
        if (collection.items.length === 0) {
          return null
        }

        return (
          <SidebarGroup key={collection.label}>
            <SidebarGroupLabel>{collection.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {collection.items.map((project) => {
                  const active = team?.id === project.id

                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={project.name}
                        className="h-auto items-start py-2"
                        onClick={() => onSelectProject(project.id)}
                      >
                        <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {project.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {project.description}
                          </span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
