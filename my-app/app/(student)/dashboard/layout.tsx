"use client"

import * as React from "react"
import Link from "next/link"
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

      <DropdownMenuContent align="end" className="w-48">
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>

      {/* Top nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b bg-background px-4">

        <SidebarTrigger />

        <div className="ml-2 text-sm text-muted-foreground">
          Progress Tracking
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">

          {/* Notification */}
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>

          {/* Profile */}
          <ProfileMenu />

        </div>
      </header>

      {/* Sidebar */}
      <AppSidebar />

      {/* Content */}
      <SidebarInset className="pt-14">
        <main className="min-w-0 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>

    </SidebarProvider>
  )
}