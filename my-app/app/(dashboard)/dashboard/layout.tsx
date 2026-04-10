"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { ThemeSwitch } from "@/components/theme-switch"
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
import {
  clearClientAuthSession,
  createMicrosoftLogoutUrl,
  readClientAuthSession,
  subscribeToAuthChange,
  type AuthSession,
} from "@/lib/auth-client"
import { RoleProvider } from "@/lib/role-context"
import { canAccessPath, roleLabels, type UserRole } from "@/lib/rbac"

function ProfileMenu({ session }: { session: AuthSession | null }) {
  const fallback = session?.user.name?.trim().charAt(0).toUpperCase() || "N"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatar.png" alt="Profile" />
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="font-medium">{session?.user.name ?? "My Account"}</div>
          {session?.user.email ? (
            <div className="text-xs font-normal text-muted-foreground">{session.user.email}</div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">Profile</Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">Settings</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
          <div className="text-foreground">Dark mode</div>
          <ThemeSwitch compact />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            const tenantId = session?.tenantId ?? "common"
            clearClientAuthSession()
            window.location.href = createMicrosoftLogoutUrl(tenantId, "/")
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccessDenied({ role }: { role: UserRole }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight">Access denied</h2>
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
  const [session, setSession] = React.useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = React.useState(true)

  React.useEffect(() => {
    const syncSession = () => {
      const nextSession = readClientAuthSession()

      if (!nextSession) {
        window.location.href = "/"
        return
      }

      setSession(nextSession)
      setAuthLoading(false)
    }

    syncSession()
    const unsubscribe = subscribeToAuthChange(syncSession)

    return () => {
      unsubscribe()
    }
  }, [])

  const role: UserRole = "student"
  const hasAccess = canAccessPath(role, pathname)

  return (
    <RoleProvider role={role}>
      <SidebarProvider>
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b bg-background/80 px-4 shadow-sm backdrop-blur-md dark:border-[#343434] dark:bg-[#171717] dark:shadow-none sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <Link href="/dashboard/board" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              <span className="text-slate-950 dark:text-slate-50">Track</span>
              <span className="text-sky-600">Sphere</span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 sm:block">
              Role: {roleLabels[role]}
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
            >
              <Bell className="h-5 w-5" />
            </Button>

            <ProfileMenu session={session} />
          </div>
        </header>

        <AppSidebar role={role} />

        <SidebarInset className="h-svh overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/60 pt-16 dark:from-[#212121] dark:to-[#171717]">
          <main className="flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6">
            {authLoading ? null : hasAccess ? children : <AccessDenied role={role} />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
