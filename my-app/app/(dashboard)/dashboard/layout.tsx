"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RoleProvider } from "@/lib/role-context"
import { canAccessPath, isUserRole, roleLabels, type UserRole } from "@/lib/rbac"

const ROLE_STORAGE_KEY = "dashboard-role"

function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatar.png" alt="Profile" />
            <AvatarFallback>N</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">Profile</Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">Settings</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => (window.location.href = "/")}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccessDenied({ role }: { role: UserRole }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold">Access denied</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The {roleLabels[role]} role cannot open this page. Go back to the landing page and choose the
        correct role, or update permissions in{" "}
        <code className="rounded bg-muted px-1 py-0.5">lib/rbac.ts</code>.
      </p>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [role, setRole] = React.useState<UserRole>("student")

  React.useEffect(() => {
    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY)

    if (isUserRole(savedRole)) {
      setRole(savedRole)
    }
  }, [])

  const hasAccess = canAccessPath(role, pathname)

  return (
    <RoleProvider role={role}>
      <SidebarProvider>
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b bg-background/80 px-4 shadow-sm backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <Link href="/" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              <span className="text-slate-950">Track</span>
              <span className="text-sky-600">Sphere</span>
            </Link>
            <div className="hidden rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-xs font-medium text-blue-700 lg:block">
              Dashboard Workspace
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 sm:block">
              Role: {roleLabels[role]}
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            >
              <Bell className="h-5 w-5" />
            </Button>

            <ProfileMenu />
          </div>
        </header>

        <AppSidebar role={role} />

        <SidebarInset className="h-svh overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/60 pt-16">
          <main className="flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6">
            {hasAccess ? children : <AccessDenied role={role} />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
