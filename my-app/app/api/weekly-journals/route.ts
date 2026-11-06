import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/server-auth"
import {
  canAccessJournal,
  listWeeklyJournalAutoSummaries,
  listWeeklyJournals,
  reviewWeeklyJournal,
  saveWeeklyJournal,
} from "@/lib/server-weekly-journal-repository"
import { notifyProjectEmailEvent } from "@/lib/server-project-email-events"
import { getDb } from "@/lib/server-db"

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
    const isSuperAdminViewer = user.id === "tester-admin"
    const visibleEntries = isSuperAdminViewer
      ? entries.map((entry) => ({
          ...entry,
          weeklyObjectives: "",
          workCompleted: "",
          memberContributions: "",
          challenges: "",
          actionsTaken: "",
          nextWeekPlan: "",
          adviserFeedback: "",
        }))
      : entries
    const visibleAutoSummaries = isSuperAdminViewer
      ? autoSummaries.map((summary) => ({
          ...summary,
          weeklyObjectives: "",
          workCompleted: "",
          memberContributions: "",
          challenges: "",
          actionsTaken: "",
          nextWeekPlan: "",
        }))
      : autoSummaries

    return NextResponse.json({
      entries: visibleEntries,
      autoSummaries: visibleAutoSummaries,
      privacyRestricted: isSuperAdminViewer,
    }, {
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
      const adviser = await getDb().query(`select 1 from projects p where p.id = $1 and (
        $3 = any(p.project_adviser) or exists (select 1 from groups g
          where g.project_id = p.id and g.adviser_user_id = $2))`, [projectId, user.id, user.name])
      if (!adviser.rowCount) return NextResponse.json({ error: "Only the assigned adviser can review this journal" }, { status: 403 })
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
    if (action === "submit" || action === "feedback") {
      await notifyProjectEmailEvent({ projectId, actorUserId: user.id, actorName: user.name,
        type: action === "submit" ? "journal_submitted" : "journal_adviser_feedback",
        weekNumber, eventId: `${entry.id}:${action === "submit" ? entry.submittedAt : entry.adviserReviewedAt}` })
    }
    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Failed to update weekly journal", error)
    return NextResponse.json({ error: "Failed to update weekly journal" }, { status: 500 })
  }
}
