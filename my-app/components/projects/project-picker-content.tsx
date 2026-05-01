"use client"

import { Check } from "lucide-react"

import { ProjectMonogram } from "@/components/projects/project-monogram"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { DashboardProject, DashboardProjectCollection } from "@/lib/projects"
import { cn } from "@/lib/utils"

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
          <div className="rounded-xl border border-dashed border-sky-200 bg-white/80 px-3 py-3 text-xs text-slate-500 dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-slate-400 sm:px-4 sm:py-4 sm:text-sm group-data-[collapsible=icon]:hidden">
            No projects yet. Wait for your adviser to set up the project workspace.
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
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {collection.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {collection.items.map((project) => {
                  const active = team?.id === project.id

                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={project.name}
                        className={cn(
                          "h-auto items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-slate-700 hover:border-sky-100 hover:bg-white/90 hover:text-slate-900 data-[active=true]:border-sky-200 data-[active=true]:bg-white data-[active=true]:text-slate-950 data-[active=true]:shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:text-slate-300 dark:hover:border-[#3f3f46] dark:hover:bg-[#242424] dark:hover:text-slate-100 dark:data-[active=true]:border-sky-500/40 dark:data-[active=true]:bg-[#262626] dark:data-[active=true]:text-slate-100 dark:data-[active=true]:shadow-none",
                          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2!"
                        )}
                        onClick={() => onSelectProject(project.id)}
                      >
                        <ProjectMonogram name={project.name} active={active} seed={project.id} />
                        <div className="min-w-0 flex-1 self-center">
                          <div className="flex items-center justify-between gap-2">
                            <span className="block truncate text-[12px] font-semibold dark:text-slate-100 sm:text-[13px]">
                              {project.name}
                            </span>
                            {active ? (
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-white">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            ) : null}
                          </div>
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
