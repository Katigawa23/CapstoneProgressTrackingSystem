"use client"

import * as React from "react"

import type { UserRole } from "@/lib/rbac"

const RoleContext = React.createContext<UserRole>("student")
const CoordinatorModeContext = React.createContext(false)
const TaskReadOnlyContext = React.createContext(true)

export function RoleProvider({
  role,
  taskReadOnly = true,
  coordinatorMode = false,
  children,
}: {
  role: UserRole
  taskReadOnly?: boolean
  coordinatorMode?: boolean
  children: React.ReactNode
}) {
  return (
    <RoleContext.Provider value={role}>
      <TaskReadOnlyContext.Provider value={taskReadOnly}>
        <CoordinatorModeContext.Provider value={coordinatorMode}>
          {children}
        </CoordinatorModeContext.Provider>
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


export function useCoordinatorMode() {
  return React.useContext(CoordinatorModeContext)
}
