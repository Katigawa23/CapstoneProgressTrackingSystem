import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  canAccessJournal,
  listWeeklyJournalAutoSummaries,
  listWeeklyJournals,
  reviewWeeklyJournal,
  saveWeeklyJournal,
} from "@/lib/server-weekly-journal-repository"

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim()
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    if (!(await canAccessJournal(projectId, user.id, user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const [entries, autoSummaries] = await Promise.all([
      listWeeklyJournals(projectId),
      listWeeklyJournalAutoSummaries(projectId),
    ])
    return NextResponse.json({ entries, autoSummaries }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Failed to load weekly journals", error)
    return NextResponse.json({ error: "Failed to load weekly journals" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUser()
    const body = await request.json() as Record<string, unknown>
    const projectId = typeof body.projectId === "string" ? body.projectId : ""
    const weekNumber = Number(body.weekNumber)
    const action = typeof body.action === "string" ? body.action : "save"
    if (!projectId || !Number.isInteger(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "Invalid project or week" }, { status: 400 })
    }
    if (!(await canAccessJournal(projectId, user.id, user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let entry
    if (action === "save" || action === "submit") {
      if (user.role !== "student") {
        return NextResponse.json({ error: "Only students can edit journal entries" }, { status: 403 })
      }
      const text = (key: string) => typeof body[key] === "string" ? String(body[key]).slice(0, 5000) : ""
      entry = await saveWeeklyJournal(projectId, weekNumber, user.id, {
        weeklyObjectives: text("weeklyObjectives"), workCompleted: text("workCompleted"),
        memberContributions: text("memberContributions"), challenges: text("challenges"),
        actionsTaken: text("actionsTaken"), nextWeekPlan: text("nextWeekPlan"),
      }, action === "submit")
    } else if (action === "feedback") {
      if (user.role !== "faculty") {
        return NextResponse.json({ error: "Only advisers can review journals" }, { status: 403 })
      }
      const adviserFeedback = String(body.adviserFeedback ?? "").trim().slice(0, 5000)
      if (!adviserFeedback) {
        return NextResponse.json({ error: "Please write adviser feedback first" }, { status: 400 })
      }
      entry = await reviewWeeklyJournal(projectId, weekNumber, "feedback", adviserFeedback, user.id)
    } else if (action === "approve") {
      if (user.id !== "tester-coordinator") {
        return NextResponse.json({ error: "Only the coordinator can approve journals" }, { status: 403 })
      }
      entry = await reviewWeeklyJournal(projectId, weekNumber, "approve", String(body.adviserFeedback ?? "").slice(0, 5000), user.id)
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!entry) {
      return NextResponse.json(
        { error: "Journal entry is unavailable or its status no longer allows this action" },
        { status: 409 }
      )
    }
    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Failed to update weekly journal", error)
    return NextResponse.json({ error: "Failed to update weekly journal" }, { status: 500 })
  }
}
