import { getDb } from "@/lib/server-db"
import { createNotification } from "@/lib/server-notification-repository"

// Resolve recipients from the saved group, never from client-supplied email addresses.
export async function notifyProjectEmailEvent(input: {
  projectId: string
  actorUserId: string
  actorName: string
  type: "adviser_assigned" | "journal_submitted" | "journal_adviser_feedback"
  weekNumber?: number
  eventId: string
}) {
  try {
    const students = input.type === "journal_adviser_feedback"
    const result = await getDb().query<{ user_id: string; project_name: string }>(`
      select distinct u.microsoft_user_id as user_id, p.project_name
      from projects p join users u on (
        ($2::boolean and lower(u.role) = 'student' and (
          u.microsoft_user_id = any(p.member_user_ids) or exists (
            select 1 from groups g where g.project_id = p.id and u.microsoft_user_id = any(g.member_user_ids)
          )
        )) or (not $2::boolean and lower(u.role) in ('faculty', 'adviser') and (
          u.name = any(p.project_adviser) or exists (
            select 1 from groups g where g.project_id = p.id and g.adviser_user_id = u.microsoft_user_id
          )
        ))
      ) where p.id = $1
    `, [input.projectId, students])
    await Promise.all(result.rows.map((row) => createNotification({
      recipientUserId: row.user_id, actorUserId: input.actorUserId, projectId: input.projectId,
      type: input.type,
      title: input.type === "adviser_assigned" ? "Assigned as group adviser"
        : students ? "Weekly journal feedback available" : "Weekly journal ready for review",
      message: input.type === "adviser_assigned"
        ? `${input.actorName} assigned you as adviser of ${row.project_name}.`
        : `${input.actorName} ${students ? "added adviser feedback to" : "submitted"} Week ${input.weekNumber} of ${row.project_name}.`,
      href: input.type === "adviser_assigned" ? "/dashboard/board"
        : `/dashboard/journal?week=${input.weekNumber}`,
      dedupeKey: `${input.type}:${input.projectId}:${input.eventId}:${row.user_id}`,
    })))
  } catch {
    console.error("Failed to queue project email notifications")
  }
}
