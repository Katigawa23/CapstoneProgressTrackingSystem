"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ChevronDown, FolderClosed, Plus } from "lucide-react"

import { ProjectMonogram } from "@/components/projects/project-monogram"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DashboardProject } from "@/lib/projects"
import { cn } from "@/lib/utils"

type ProjectSwitcherProps = {
  canCreateProject?: boolean
  displayName?: string
  onCreateProject: () => void
  onSelectProject: (projectId: string) => void
  projects: DashboardProject[]
  team: DashboardProject | null
}

export function ProjectSwitcher({
  canCreateProject = true,
  displayName,
  onCreateProject,
  onSelectProject,
  projects,
  team,
}: ProjectSwitcherProps) {
  const [mounted, setMounted] = React.useState(false)
  const visibleProjects = projects.slice(0, 3)
  const teamName = displayName ?? team?.name ?? "Create project"
  const activeProjectId = team?.id
  const shouldUseFolderIcon = Boolean(displayName) || !team
  const switcherIcon = shouldUseFolderIcon ? FolderClosed : undefined
  const projectSummary =
    projects.length === 0
      ? "Set up your first capstone project workspace."
      : `${projects.length} project${projects.length === 1 ? "" : "s"} available`

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        type="button"
        suppressHydrationWarning
        className="
          group flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-sky-100
          bg-white px-2 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors sm:min-h-12
          dark:border-[#343434] dark:bg-[#242424]
          group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:flex-none
          group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg
          group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent
          group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:shadow-none
        "
      >
        <ProjectMonogram
          name={teamName}
          active={Boolean(team)}
          icon={switcherIcon}
          seed={team?.id ?? teamName}
          size="large"
          className={switcherIcon ? "bg-gradient-to-br from-[#2972b6] to-[#185a96] text-white shadow-sm ring-1 ring-blue-200/60" : undefined}
        />

        <div className="min-w-0 flex-1 self-center group-data-[collapsible=icon]:hidden">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Project
          </div>
          <div className="truncate leading-tight text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-[13px]">
            {teamName}
          </div>
        </div>

        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 group-data-[collapsible=icon]:hidden dark:text-slate-500" />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          suppressHydrationWarning
          className="
            group flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-sky-100
            bg-white px-2 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors sm:min-h-12
            hover:border-sky-200 hover:bg-sky-50/40 data-[state=open]:border-sky-300
            data-[state=open]:bg-sky-50/70
            dark:border-[#343434] dark:bg-[#242424] dark:hover:border-[#454545] dark:hover:bg-[#2a2a2a]
            dark:data-[state=open]:border-[#4a4a4a] dark:data-[state=open]:bg-[#2a2a2a]
            group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:flex-none
            group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg
            group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent
            group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:shadow-none
            group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:hover:bg-transparent
            group-data-[collapsible=icon]:data-[state=open]:border-transparent
            group-data-[collapsible=icon]:data-[state=open]:bg-transparent
          "
        >
          <ProjectMonogram
            name={teamName}
            active={Boolean(team)}
            icon={switcherIcon}
            seed={team?.id ?? teamName}
            size="large"
            className={switcherIcon ? "bg-gradient-to-br from-[#2972b6] to-[#185a96] text-white shadow-sm ring-1 ring-blue-200/60" : undefined}
          />

          <div className="min-w-0 flex-1 self-center group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Project
            </div>
            <div className="truncate leading-tight text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-[13px]">
              {teamName}
            </div>
          </div>

          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]:rotate-180 dark:text-slate-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[min(16.5rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-[#343434] dark:bg-[#1f1f1f] dark:text-slate-100 dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuLabel className="p-0">
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 dark:border-[#343434] dark:bg-[#262626]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Current project
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <ProjectMonogram
                name={teamName}
                active={Boolean(team)}
                icon={switcherIcon}
                seed={team?.id ?? teamName}
                className={switcherIcon ? "bg-gradient-to-br from-[#2972b6] to-[#185a96] text-white shadow-sm ring-1 ring-blue-200/60" : undefined}
              />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-slate-900 dark:text-slate-100 sm:text-[13px]">{teamName}</div>
                <div className="hidden truncate text-[10px] text-slate-500 dark:text-slate-400 sm:block">{projectSummary}</div>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {projects.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Switch project
              </div>
              <Link
                href="/dashboard"
                className="text-[10px] font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
              >
                View all
              </Link>
            </div>
            <DropdownMenuGroup>
              {visibleProjects.map((project) => {
                const active = activeProjectId === project.id

                return (
                  <DropdownMenuItem
                    key={project.id}
                    className={cn(
                      "cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 focus:bg-sky-50 focus:text-slate-950 dark:focus:bg-[#2a2a2a] dark:focus:text-slate-100",
                      active && "border-sky-100 bg-sky-50/80 dark:border-[#3b82f6]/30 dark:bg-[#1f2937]"
                    )}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <ProjectMonogram
                      name={project.name}
                      active={active}
                      seed={project.id}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-slate-900 dark:text-slate-100 sm:text-[13px]">
                        {project.name}
                      </div>
                    </div>

                    {active ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Quick actions
        </div>
        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-sky-50 dark:focus:bg-[#2a2a2a]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ProjectMonogram name="Projects" icon={FolderClosed} />
            <span className="truncate text-[12px] font-medium text-slate-900 dark:text-slate-100 sm:text-[13px]">Browse all projects</span>
          </Link>
        </DropdownMenuItem>
        {canCreateProject ? (
          <DropdownMenuItem
            className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-sky-50 dark:focus:bg-[#2a2a2a]"
            onSelect={(event) => {
              event.preventDefault()
              onCreateProject()
            }}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-600 text-white shadow-sm">
                <Plus className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="truncate text-[12px] font-medium text-slate-900 dark:text-slate-100 sm:text-[13px]">Create project</span>
            </span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
