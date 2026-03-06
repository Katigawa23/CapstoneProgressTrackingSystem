// app/api/db-test/route.ts
import { getDb } from "@/lib/db"

export async function GET() {
  try {
    const db = getDb()
    const result = await db.query("SELECT NOW() as now")

    return Response.json({
      ok: true,
      now: result.rows[0].now,
    })
  } catch (error) {
    console.error("DB test failed:", error)

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}