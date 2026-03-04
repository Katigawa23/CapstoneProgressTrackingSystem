"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { History, Milestone, Notebook, Map, FolderSync, FilePen} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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
import {
  ChevronsUpDown,
  LayoutDashboard,
  BookOpen,
  Star,
  Settings,
  Users,
  Home,
  Folder,
} from "lucide-react"
import clsx from "clsx"

type NavItem = { title: string; href: string; icon?: React.ElementType }

const projectItems: NavItem[] = [
  { title: "Board", href: "/dashboard", icon: LayoutDashboard },
  { title: "Roadmap", href: "/dashboard/roadmap", icon: Map },
  { title: "To-do", href: "/dashboard/todo", icon: Notebook },
  { title: "Revisions", href: "/dashboard/revisions", icon: FilePen },
]

const documentationItems: NavItem[] = [
  { title: "Weekly Journal", href: "/dashboard/journal", icon: BookOpen },
  { title: "Milestones", href: "/dashboard/milestones", icon: Milestone },
  { title: "Backlog", href: "/dashboard/backlog", icon: FolderSync },
  { title: "History", href: "/dashboard/history", icon: History },
]

const groupItems: NavItem[] = [
  { title: "Members", href: "/dashboard/members", icon: Users },
  { title: "Advisers", href: "/dashboard/adviser", icon: Users },
]

function TeamSwitcher() {
  const [team] = React.useState("MyApp")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="
            group flex w-full items-center gap-3 rounded-lg px-2 py-2
            text-left hover:bg-muted/60
            group-data-[collapsible=icon]:justify-center
            group-data-[collapsible=icon]:px-0
          "
        >
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl  bg-[#2972b6] shadow-sm">
            <Folder className="h-5 w-5 text-white" />
          </div>

          {/* Text (hidden when collapsed) */}
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">{team}</div>
            <div className="truncate text-xs text-muted-foreground">
              Enterprise
            </div>
          </div>

          {/* Caret (hidden when collapsed) */}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Manuscript</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="top-14 h-[calc(100vh-56px)]" // ✅ push down under navbar
    >
      <SidebarHeader className="px-2 pt-2">
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={projectItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        <SidebarGroup>
          <SidebarGroupLabel>Documentation</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={documentationItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        <SidebarGroup>
          <SidebarGroupLabel>Groups</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={groupItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}