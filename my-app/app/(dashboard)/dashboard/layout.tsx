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

type AuthSession = {
  user: {
    id: string
    name: string
    email: string
  }
  expiresAt: string
}

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

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{session?.user.name ?? "My Account"}</div>
          {session?.user.email ? (
            <div className="text-xs font-normal text-muted-foreground">{session.user.email}</div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">Profile</Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">Settings</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => (window.location.href = "/api/auth/logout")}>
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
  const [session, setSession] = React.useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = React.useState(true)

  React.useEffect(() => {
    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY)

    if (isUserRole(savedRole)) {
      setRole(savedRole)
    }
  }, [])

  React.useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          window.location.href = "/"
          return
        }

        const data = (await response.json()) as {
          authenticated: boolean
          session?: AuthSession
        }

        if (!data.authenticated || !data.session) {
          window.location.href = "/"
          return
        }

        if (isMounted) {
          setSession(data.session)
          setAuthLoading(false)
        }
      } catch {
        window.location.href = "/"
      }
    }

    void loadSession()

    return () => {
      isMounted = false
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

            <ProfileMenu session={session} />
          </div>
        </header>

        <AppSidebar role={role} />

        <SidebarInset className="h-svh overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/60 pt-16">
          <main className="flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-6">
            {authLoading ? null : hasAccess ? children : <AccessDenied role={role} />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  )
}
