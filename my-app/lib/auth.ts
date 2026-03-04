export type Role = "student" | "adviser" | "admin"

// TEMP ONLY: change to test
let currentRole: Role = "student"

export function setRole(role: Role) {
  currentRole = role
}

export function getRole(): Role {
  return currentRole
}