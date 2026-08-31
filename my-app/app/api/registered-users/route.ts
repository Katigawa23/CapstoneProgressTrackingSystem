import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { searchRegisteredMicrosoftUsers } from "@backend/repositories/users-repository"

type UserRoleFilter = "student" | "faculty"

function normalizeRoleFilter(value: string | null): UserRoleFilter | null {
  return value === "student" || value === "faculty" ? value : null
}

function matchesRole(role: string, filter: UserRoleFilter | null) {
  if (!filter) return true
  const normalizedRole = role.trim().toLowerCase()
  return filter === "faculty"
    ? normalizedRole === "faculty" || normalizedRole === "adviser"
    : normalizedRole === "student"
}

async function searchSupabaseUsers(tenantId: string, query: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl || !supabaseKey) return []

  const url = new URL(`${supabaseUrl}/rest/v1/users`)
  url.searchParams.set("select", "microsoft_user_id,email,name,role,tenant_id,login_at")
  url.searchParams.set("tenant_id", `eq.${tenantId}`)
  url.searchParams.set("order", "name.asc")
  url.searchParams.set("limit", "20")
  if (query.trim()) {
    const safeQuery = query.trim().replace(/[,*()]/g, "")
    url.searchParams.set("or", `(name.ilike.*${safeQuery}*,email.ilike.*${safeQuery}*)`)
  }

  const response = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    cache: "no-store",
  })
  if (!response.ok) {
    const errorBody = await response.text()
    console.error("Supabase users lookup failed:", response.status, errorBody)
    return []
  }

  const rows = (await response.json()) as Array<{
    microsoft_user_id: string
    email: string
    name: string
    role: string
    tenant_id: string
    login_at: string
  }>
  return rows.map((row) => ({
    id: row.microsoft_user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenantId: row.tenant_id,
    loginAt: row.login_at,
  }))
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") ?? ""
    const roleFilter = normalizeRoleFilter(searchParams.get("role"))

    let users
    try {
      users = await searchRegisteredMicrosoftUsers({ tenantId: user.tenantId, query })
    } catch (databaseError) {
      console.warn(
        "PostgreSQL user lookup unavailable; using Supabase REST:",
        databaseError instanceof Error ? databaseError.message : databaseError
      )
      users = await searchSupabaseUsers(user.tenantId, query)
    }
    const currentUserId = user.id.trim().toLowerCase()
    const currentUserEmail = user.email.trim().toLowerCase()
    const filteredUsers = users.filter((registeredUser) => {
      const registeredUserId = registeredUser.id.trim().toLowerCase()
      const registeredUserEmail = registeredUser.email.trim().toLowerCase()

      return (
        registeredUserId !== currentUserId &&
        registeredUserEmail !== currentUserEmail &&
        matchesRole(registeredUser.role, roleFilter)
      )
    })

    return NextResponse.json(
      { users: filteredUsers },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Failed to load registered users", error)
    return NextResponse.json({ error: "Failed to load registered users" }, { status: 500 })
  }
}
