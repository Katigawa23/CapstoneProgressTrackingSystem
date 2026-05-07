"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { ThemeSwitch } from "@/components/theme-switch"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

import { Button } from "@/components/ui/button"

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
  markDashboardSessionBootstrapped,
  readClientAuthSession,
  subscribeToAuthChange,
  type AuthSession,
} from "@/lib/auth-client"
import { type DashboardProject } from "@/lib/projects"
import { RoleProvider } from "@/lib/role-context"
import { canAccessPath, isUserRole, roleLabels, type UserRole } from "@/lib/rbac"
import { BacklogLoadingSkeleton } from "./backlog/backlog-loading-skeleton"

function ProfileMenu({
  session,
  disabled = false,
}: {
  session: AuthSession | null
  disabled?: boolean
}) {
  const initials = (session?.user.name ?? "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "KM"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0" disabled={disabled}>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tracking-tight text-[var(--brand-primary-fixed-foreground)]"
            style={{
              backgroundColor: "var(--brand-primary-fixed)",
            }}
          >
            {initials}
          </span>
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

        <DropdownMenuItem
          onClick={async () => {
            const tenantId = session?.tenantId ?? "common"
            clearClientAuthSession()
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            }).catch(() => undefined)
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

export function DashboardLayoutClient({
  children,
  initialAuthSession,
  initialProjects,
  initialTeam,
}: {
  children: React.ReactNode
  initialAuthSession: AuthSession | null
  initialProjects: DashboardProject[]
  initialTeam: DashboardProject | null
}) {
  const pathname = usePathname()
  const [session, setSession] = React.useState<AuthSession | null>(initialAuthSession)
  const [authLoading, setAuthLoading] = React.useState(!initialAuthSession)
  React.useEffect(() => {
    const syncSession = () => {
      const nextSession = readClientAuthSession()

      if (!nextSession) {
        if (initialAuthSession) {
          setSession(initialAuthSession)
          markDashboardSessionBootstrapped()
          setAuthLoading(false)
          return
        }

        window.location.href = "/"
        return
      }

      setSession(nextSession)
      markDashboardSessionBootstrapped()
      setAuthLoading(false)
    }

    syncSession()
    const unsubscribe = subscribeToAuthChange(syncSession)

    return () => {
      unsubscribe()
    }
  }, [initialAuthSession])

  const role: UserRole = isUserRole(session?.user.role) ? session.user.role : "student"
  const hasAccess = canAccessPath(role, pathname)

  return (
    <RoleProvider role={role}>
      <SidebarProvider>
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b bg-background/80 px-4 shadow-sm backdrop-blur-md dark:border-[#343434] dark:bg-[#171717] dark:shadow-none sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <Link
              href="/dashboard/board"
              className="flex items-center gap-3 font-display text-xl font-extrabold tracking-tight sm:text-2xl"
            >
              <Image
                src="/logoTS.png"
                alt="TrackSphere logo"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
              <span>
                <span className="text-slate-950 dark:text-slate-50">Track</span>
                <span className="text-sky-600">Sphere</span>
              </span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitch iconOnly disabled={authLoading} />

            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              disabled={authLoading}
              className="rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
            >
              <Bell className="h-5 w-5" />
            </Button>

            <ProfileMenu session={session} disabled={authLoading} />
          </div>
        </header>

        <AppSidebar role={role} initialProjects={initialProjects} initialTeam={initialTeam} />

        <SidebarInset className="h-svh overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/60 pt-16 dark:from-[#212121] dark:to-[#171717]">
          <main className="flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6 xl:px-8 xl:py-6 2xl:px-10">
            {authLoading
              ? pathname === "/dashboard/backlog"
                ? <BacklogLoadingSkeleton />
                : null
              : hasAccess
                ? children
                : <AccessDenied role={role} />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
