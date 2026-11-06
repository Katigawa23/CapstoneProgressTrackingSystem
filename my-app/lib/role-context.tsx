"use client"

import * as React from "react"

import type { UserRole } from "@/lib/rbac"

const RoleContext = React.createContext<UserRole>("student")
const TaskReadOnlyContext = React.createContext(true)

export function RoleProvider({
  role,
  taskReadOnly = true,
  children,
}: {
  role: UserRole
  taskReadOnly?: boolean
  children: React.ReactNode
}) {
  return (
    <RoleContext.Provider value={role}>
      <TaskReadOnlyContext.Provider value={taskReadOnly}>
        {children}
      </TaskReadOnlyContext.Provider>
    </RoleContext.Provider>
  )
}

export function useRole() {
  return React.useContext(RoleContext)
}

export function useTaskReadOnly() {
  return React.useContext(TaskReadOnlyContext)
}

