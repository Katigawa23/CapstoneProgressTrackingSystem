"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      {/* Top nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger />
        <div className="text-sm text-muted-foreground">Progress Tracking</div>
      </header>

      {/* Sidebar */}
      <AppSidebar />

      {/* Content */}
      <SidebarInset className="pt-14">
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}