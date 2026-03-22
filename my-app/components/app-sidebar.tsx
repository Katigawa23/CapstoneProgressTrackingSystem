"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  FilePen,
  History,
  LayoutDashboard,
  Map,
  Milestone,
  Rows3,
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
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { ProjectPickerContent } from "@/components/projects/project-picker-content"
import { ProjectSwitcher } from "@/components/projects/project-switcher"
import { getDashboardProjectCollections } from "@/lib/projects"
import { useDashboardProjects } from "@/hooks/use-dashboard-projects"
import { canAccessPath, type UserRole } from "@/lib/rbac"

type NavItem = { title: string; href: string; icon?: React.ElementType }

const projectItems: NavItem[] = [
  { title: "Board", href: "/dashboard/board", icon: LayoutDashboard },
  { title: "Roadmap", href: "/dashboard/roadmap", icon: Map },
  { title: "Backlog", href: "/dashboard/backlog", icon: Rows3},
  { title: "Revisions", href: "/dashboard/revisions", icon: FilePen },
]

const documentationItems: NavItem[] = [
  { title: "Weekly Journal", href: "/dashboard/journal", icon: BookOpen },
  { title: "Milestones", href: "/dashboard/milestones", icon: Milestone },
  { title: "History", href: "/dashboard/history", icon: History },
]

const groupItems: NavItem[] = [
  { title: "Members", href: "/dashboard/members", icon: Users },
  { title: "Advisers", href: "/dashboard/adviser", icon: Users },
]

function NavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link href={item.href} className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function filterItemsByRole(items: NavItem[], role: UserRole) {
  return items.filter((item) => canAccessPath(role, item.href))
}

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
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
  } = useDashboardProjects()
  const projectCollections = getDashboardProjectCollections(projects)
  const visibleProjectItems = filterItemsByRole(projectItems, role)
  const visibleDocumentationItems = filterItemsByRole(documentationItems, role)
  const visibleGroupItems = filterItemsByRole(groupItems, role)
  const isProjectPickerPage = pathname === "/dashboard"

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
        onCreateProject={createProject}
        onMemberSearchChange={setMemberSearch}
        onProjectDescriptionChange={setProjectDescription}
        onProjectTitleChange={setProjectTitle}
        projectDescription={projectDescription}
        projectTitle={projectTitle}
      />

      <Sidebar collapsible="icon" className="top-14 h-[calc(100vh-56px)]">
        <SidebarHeader className="px-1 pt-2">
          <ProjectSwitcher
            displayName={isProjectPickerPage ? "Create project" : undefined}
            onCreateProject={() => setCreateProjectOpen(true)}
            onSelectProject={(projectId) => {
              selectProject(projectId)
              router.push("/dashboard/board")
            }}
            projects={projects}
            team={team}
          />
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
                <SidebarGroupLabel>Project</SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleProjectItems} />
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator />

              <SidebarGroup>
                <SidebarGroupLabel>Documentation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleDocumentationItems} />
                </SidebarGroupContent>
              </SidebarGroup>

              <Separator />

              <SidebarGroup>
                <SidebarGroupLabel>Groups</SidebarGroupLabel>
                <SidebarGroupContent>
                  <NavList items={visibleGroupItems} />
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="hidden px-2 pb-2 pt-0 md:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5">
          <SidebarTrigger className="h-9 w-full justify-start px-2 text-muted-foreground hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}
