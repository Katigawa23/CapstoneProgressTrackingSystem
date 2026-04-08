"use client"

import Link from "next/link"
import { Check, ChevronDown, FolderOpen, Plus } from "lucide-react"

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
  const visibleProjects = projects.slice(0, 3)
  const teamName = displayName ?? team?.name ?? "Create project"
  const activeProjectId = team?.id
  const projectSummary =
    projects.length === 0
      ? "Set up your first capstone project workspace."
      : `${projects.length} project${projects.length === 1 ? "" : "s"} available`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="
            group flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-sky-100
            bg-white px-2 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors sm:min-h-12
            hover:border-sky-200 hover:bg-sky-50/40 data-[state=open]:border-sky-300
            data-[state=open]:bg-sky-50/70
            group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:flex-none
            group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg
            group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent
            group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:shadow-none
            group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:hover:bg-transparent
            group-data-[collapsible=icon]:data-[state=open]:border-transparent
            group-data-[collapsible=icon]:data-[state=open]:bg-transparent
          "
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#2972b6] to-[#185a96] shadow-sm ring-1 ring-blue-200/60">
            <FolderOpen className="h-4 w-4 text-white" />
          </div>

          <div className="min-w-0 flex-1 self-center group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Project
            </div>
            <div className="truncate leading-tight text-[12px] font-semibold text-slate-900 sm:text-[13px]">
              {teamName}
            </div>
          </div>

          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[min(16.5rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
      >
        <DropdownMenuLabel className="p-0">
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Current project
            </div>
            <div className="mt-1.5 flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#2972b6] to-[#185a96] shadow-sm ring-1 ring-blue-200/60">
                <FolderOpen className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-slate-900 sm:text-[13px]">{teamName}</div>
                <div className="hidden truncate text-[10px] text-slate-500 sm:block">{projectSummary}</div>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {projects.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Switch project
              </div>
              <Link
                href="/dashboard"
                className="text-[10px] font-medium text-sky-600 transition hover:text-sky-700"
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
                      "cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 focus:bg-sky-50 focus:text-slate-950",
                      active && "border-sky-100 bg-sky-50/80"
                    )}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                        active
                          ? "border-sky-200 bg-white text-sky-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      )}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-slate-900 sm:text-[13px]">
                        {project.name}
                      </div>
                    </div>

                    {active ? (
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
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

        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Quick actions
        </div>
        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-sky-50">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
              <FolderOpen className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-[12px] font-medium text-slate-900 sm:text-[13px]">Browse all projects</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-md px-2 py-1.5 focus:bg-sky-50"
          onSelect={(event) => {
            event.preventDefault()
            onCreateProject()
          }}
        >
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-600 text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-[12px] font-medium text-slate-900 sm:text-[13px]">Create project</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
