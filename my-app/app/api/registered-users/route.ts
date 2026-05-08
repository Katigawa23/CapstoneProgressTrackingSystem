import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import { searchRegisteredMicrosoftUsers } from "@backend/repositories/microsoft-login-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") ?? ""

    const users = await searchRegisteredMicrosoftUsers({
      tenantId: user.tenantId,
      query,
    })
    const filteredUsers = users.filter((registeredUser) => registeredUser.id !== user.id)

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
