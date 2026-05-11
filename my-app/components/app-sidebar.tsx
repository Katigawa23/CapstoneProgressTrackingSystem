"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Archive,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  Map,
  Milestone,
  Rows3,
  Trash2,
  Users,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { ProjectPickerContent } from "@/components/projects/project-picker-content"
import { ProjectSwitcher } from "@/components/projects/project-switcher"
import { getDashboardProjectCollections, type DashboardProject } from "@/lib/projects"
import { useDashboardProjects } from "@/hooks/use-dashboard-projects"
import { canAccessPath, canCreateProject, type UserRole } from "@/lib/rbac"

type NavItem = {
  title: string
  href: string
  icon?: React.ElementType
  imageSrc?: string
  external?: boolean
  children?: NavItem[]
}

const projectItems: NavItem[] = [
  {
    title: "Board",
    href: "/dashboard/board",
    icon: LayoutDashboard,
    children: [{ title: "Active Sprint", href: "/dashboard/active-sprint" }],
  },
  { title: "Roadmap", href: "/dashboard/roadmap", icon: Map },
  { title: "Backlog", href: "/dashboard/backlog", icon: Rows3},
]

const documentationItems: NavItem[] = [
  { title: "Weekly Journal", href: "/dashboard/journal", icon: BookOpen },
  { title: "Milestones", href: "/dashboard/milestones", icon: Milestone },
  { title: "Archive", href: "/dashboard/archive", icon: Archive },
  { title: "Recycle Bin", href: "/dashboard/recycle-bin", icon: Trash2 },
]

const getGroupItems = (role: UserRole): NavItem[] => [
  { title: "Members", href: "/dashboard/members", icon: Users },
  { title: role === "faculty" ? "Students" : "Advisers", href: "/dashboard/adviser", icon: Users },
]

const quickLinkItems: NavItem[] = [
  {
    title: "ELMS",
    href: "https://elms.sti.edu/",
    imageSrc:
      "https://elms.sti.edu/files/2534719/STI_LOGO_for_eLMS(2).png?lmsauth=fe6600bdab0aafc21e4a67526017a8ded0be21f5",
    external: true,
  },
  {
    title: "ONE STI",
    href: "https://one.sti.edu/",
    imageSrc: "https://one.sti.edu/images/onesti_logo.png",
    external: true,
  },
]

function NavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = item.external ? false : pathname === item.href
        const hasActiveChild =
          item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false
        const Icon = item.icon
        const imageAlt = `${item.title} logo`

        return (
          <SidebarMenuItem key={item.href}>
            {item.children?.length ? (
              <Collapsible
                defaultOpen={hasActiveChild}
                className="group/collapsible"
              >
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={active}
                  className="rounded-xl px-3 py-2.5 text-slate-600 hover:text-blue-700 data-[active=true]:bg-white data-[active=true]:text-blue-700 data-[active=true]:shadow-sm dark:text-slate-300 dark:hover:text-sky-400 dark:data-[active=true]:bg-slate-900 dark:data-[active=true]:text-sky-400 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-0"
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-2"
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer noopener" : undefined}
                  >
                    {item.imageSrc ? (
                      <img
                        src={item.imageSrc}
                        alt={imageAlt}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : null}
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction
                    className="text-slate-500 hover:bg-transparent hover:text-blue-700 dark:text-slate-400 dark:hover:bg-transparent dark:hover:text-sky-400 group-data-[collapsible=icon]:hidden"
                    showOnHover={false}
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-1">
                  <SidebarMenuSub className="mx-4 mt-1 border-slate-200/90 pl-3 dark:border-slate-800">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`)

                      return (
                        <SidebarMenuSubItem key={child.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={childActive}
                            className="h-8 rounded-lg px-3 text-sm font-normal text-slate-600 hover:text-blue-700 data-[active=true]:bg-white data-[active=true]:text-blue-700 dark:text-slate-300 dark:hover:text-sky-400 dark:data-[active=true]:bg-slate-900 dark:data-[active=true]:text-sky-400"
                          >
                            <Link href={child.href}>
                              <span>{child.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={active}
                tooltip={item.title}
                className="rounded-xl px-3 py-2.5 text-slate-600 hover:text-blue-700 data-[active=true]:bg-white data-[active=true]:text-blue-700 data-[active=true]:shadow-sm dark:text-slate-300 dark:hover:text-sky-400 dark:data-[active=true]:bg-slate-900 dark:data-[active=true]:text-sky-400 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-0"
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-2"
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer noopener" : undefined}
                >
                  {item.imageSrc ? (
                    <img
                      src={item.imageSrc}
                      alt={imageAlt}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : null}
                  <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function filterItemsByRole(items: NavItem[], role: UserRole) {
  return items
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canAccessPath(role, child.href)),
    }))
    .filter(
      (item) =>
        item.external ||
        canAccessPath(role, item.href) ||
        Boolean(item.children && item.children.length > 0)
    )
}

export function AppSidebar({
  role,
  initialProjects = [],
  initialTeam = null,
}: {
  role: UserRole
  initialProjects?: DashboardProject[]
  initialTeam?: DashboardProject | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    createProject,
    createProjectOpen,
    createProjectError,
    handleMemberSearchChange,
    handleMemberRoleToggle,
    handleMemberSelect,
    handleProjectTitleChange,
    isCreatingProject,
    memberSearch,
    memberOptions,
    memberOptionsLoading,
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
    selectedMembers,
    selectProject,
    setCreateProjectOpen,
    setProjectProgram,
    setProjectProgramOther,
    setProjectSyTerm,
    setProjectSyTermOther,
    setProjectType,
    setProjectTypeOther,
    setProjectYearLevel,
    setProjectYearLevelOther,
    team,
  } = useDashboardProjects({
    initialProjects,
    initialTeam,
  })
  const projectCollections = getDashboardProjectCollections(projects)
  const visibleProjectItems = filterItemsByRole(projectItems, role)
  const visibleDocumentationItems = filterItemsByRole(documentationItems, role)
  const visibleGroupItems = filterItemsByRole(getGroupItems(role), role)
  const visibleQuickLinkItems = filterItemsByRole(quickLinkItems, role)
  const isProjectPickerPage =
    pathname === "/dashboard" || pathname === "/dashboard/projects"
  const canCreateProjectAccess = canCreateProject(role)

  React.useEffect(() => {
    const handleOpenCreateProject = () => {
      if (!canCreateProjectAccess) {
        return
      }

      setCreateProjectOpen(true)
    }

    window.addEventListener("tracksphere-open-create-project", handleOpenCreateProject)

    return () => {
      window.removeEventListener("tracksphere-open-create-project", handleOpenCreateProject)
    }
  }, [canCreateProjectAccess, setCreateProjectOpen])

  return (
    <>
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={(open) => {
          setCreateProjectOpen(open)
          if (!open) {
            resetCreateProjectForm()
          }
        }}
        memberSearch={memberSearch}
        memberOptions={memberOptions}
        memberOptionsLoading={memberOptionsLoading}
        onCreateProject={createProject}
        onMemberSearchChange={handleMemberSearchChange}
        onMemberRoleToggle={handleMemberRoleToggle}
        onMemberSelect={handleMemberSelect}
        onProjectProgramChange={setProjectProgram}
        onProjectProgramOtherChange={setProjectProgramOther}
        onProjectSyTermChange={setProjectSyTerm}
        onProjectSyTermOtherChange={setProjectSyTermOther}
        onProjectTitleChange={handleProjectTitleChange}
        onProjectTypeChange={setProjectType}
        onProjectTypeOtherChange={setProjectTypeOther}
        onProjectYearLevelChange={setProjectYearLevel}
        onProjectYearLevelOtherChange={setProjectYearLevelOther}
        titleError={createProjectError}
        isSubmitting={isCreatingProject}
        projectProgram={projectProgram}
        projectProgramOther={projectProgramOther}
        projectSyTerm={projectSyTerm}
        projectSyTermOther={projectSyTermOther}
        projectTitle={projectTitle}
        projectType={projectType}
        projectTypeOther={projectTypeOther}
        projectYearLevel={projectYearLevel}
        projectYearLevelOther={projectYearLevelOther}
        selectedMembers={selectedMembers}
      />

      <Sidebar
        collapsible="icon"
        className="relative top-16 h-[calc(100vh-64px)] border-r border-blue-100/70 shadow-[10px_0_26px_-20px_rgba(15,23,42,0.28)] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-blue-200/85 [--sidebar:#f7fbff] [--sidebar-border:#dbeafe] [--sidebar-accent:#e8f1ff] [--sidebar-accent-foreground:#2563eb] [--sidebar-foreground:#334155] dark:border-[#3a3a3a] dark:shadow-[10px_0_26px_-20px_rgba(0,0,0,0.85)] dark:after:bg-[#3a3a3a] dark:[--sidebar:#171717] dark:[--sidebar-border:#2f2f2f] dark:[--sidebar-accent:#242424] dark:[--sidebar-accent-foreground:#ffffff] dark:[--sidebar-foreground:#e5e5e5]"
      >
        <SidebarHeader className="gap-4 px-3 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
          <div className="rounded-xl bg-transparent">
            <ProjectSwitcher
              canCreateProject={canCreateProjectAccess}
              displayName={isProjectPickerPage ? "Choose project" : undefined}
              onCreateProject={() => {
                if (!canCreateProjectAccess) {
                  return
                }

                setCreateProjectOpen(true)
              }}
              onSelectProject={(projectId) => {
                selectProject(projectId)
                router.push("/dashboard/board")
              }}
              projects={projects}
              team={team}
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-2">
          {isProjectPickerPage ? (
            <ProjectPickerContent
              collections={projectCollections}
              onSelectProject={(projectId) => {
                selectProject(projectId)
                router.push("/dashboard/board")
              }}
              projects={projects}
              team={team}
            />
          ) : (
            <>
              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Project
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleProjectItems} />
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="bg-blue-100 dark:bg-slate-800" />

              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Documentation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleDocumentationItems} />
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="bg-blue-100 dark:bg-slate-800" />

              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Groups
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleGroupItems} />
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator className="bg-blue-100 dark:bg-slate-800" />

              <SidebarGroup>
                <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Shortcut - URLs
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleQuickLinkItems} />
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="hidden px-2 pb-3 pt-0 md:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5">
          <SidebarTrigger className="h-10 w-full justify-start rounded-xl px-3 text-slate-500 hover:bg-white hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-sky-400 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}
