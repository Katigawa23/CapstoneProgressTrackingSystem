"use client"

import * as React from "react"

import type { UserRole } from "@/lib/rbac"

const RoleContext = React.createContext<UserRole>("student")

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole() {
  return React.useContext(RoleContext)
}

