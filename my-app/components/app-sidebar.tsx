"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { History, Milestone, Map, FolderSync, FilePen, Rows3 } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { ChevronsUpDown, LayoutDashboard, BookOpen, Users, Folder } from "lucide-react"
import { canAccessPath, type UserRole } from "@/lib/rbac"

type NavItem = { title: string; href: string; icon?: React.ElementType }

const projectItems: NavItem[] = [
  { title: "Board", href: "/dashboard", icon: LayoutDashboard },
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

function TeamSwitcher() {
  const [team] = React.useState("MyApp")

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="
              group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2
              text-left hover:bg-muted/60
              group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:flex-none
              group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl
              group-data-[collapsible=icon]:px-0
            "
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2972b6] shadow-sm">
              <Folder className="h-5 w-5 text-white" />
            </div>

            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-semibold">{team}</div>
              <div className="truncate text-xs text-muted-foreground">Project</div>
            </div>

            <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Manuscript</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

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
  const visibleProjectItems = filterItemsByRole(projectItems, role)
  const visibleDocumentationItems = filterItemsByRole(documentationItems, role)
  const visibleGroupItems = filterItemsByRole(groupItems, role)

  return (
    <Sidebar collapsible="icon" className="top-14 h-[calc(100vh-56px)]">
      <SidebarHeader className="px-1 pt-2">
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent className="gap-2">
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
      </SidebarContent>

      <SidebarFooter className="hidden px-2 pb-2 pt-0 md:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5">
        <SidebarTrigger className="h-9 w-full justify-start px-2 text-muted-foreground hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
