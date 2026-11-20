import { getDb } from "@/lib/server-db"
import { ensureActiveSessionSchema } from "@/lib/server-active-session"
import { ensureCoordinatorAssignmentSchema } from "@/lib/server-coordinator-assignments"
import { ensureProjectsSchema } from "@/lib/server-project-repository"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"

export type FacultyVerification = {
  userId: string; name: string; email: string; status: "pending" | "approved" | "rejected" | "revoked"
  submittedAt: string; reason: string | null
}
export async function getFacultyAccessState(userId: string) {
  await ensureMicrosoftLoginSchema()
  const result = await getDb().query<{ status: string; reason: string | null; used: number; retryAt: string | null }>(
    `select faculty_verification_status as status, faculty_rejection_reason as reason,
       (select count(*)::int from unnest(faculty_submission_attempts) as attempt where attempt > now()-interval '24 hours') as used,
       (select case when count(*) >= 5 then (min(attempt)+interval '24 hours')::text else null end
         from unnest(faculty_submission_attempts) as attempt where attempt > now()-interval '24 hours') as "retryAt"
     from users where microsoft_user_id=$1 order by login_at desc limit 1`, [userId])
  return result.rows[0] ?? { status: "pending", reason: null, used: 0, retryAt: null }
}
export async function listFacultyVerifications(tenantId: string) {
  await ensureMicrosoftLoginSchema()
  const result = await getDb().query<FacultyVerification>(`
    select distinct on (microsoft_user_id) microsoft_user_id as "userId", name, email,
      faculty_verification_status as status, faculty_requested_at::text as "submittedAt", faculty_rejection_reason as reason
    from users where tenant_id=$1 and role='faculty'
    order by microsoft_user_id, login_at desc`, [tenantId])
  return result.rows
}
export async function reviewFacultyVerification(input: { userId: string; tenantId: string; reviewerId: string; status: "approved" | "rejected" | "revoked" | "restore"; reason: string }) {
  await ensureMicrosoftLoginSchema()
  await ensureActiveSessionSchema()
  const source = input.status === "restore" ? "revoked" : input.status === "revoked" ? "approved" : "pending"
  const status = input.status === "restore" ? "approved" : input.status
  let assignmentGuard = ""
  if (status === "revoked") {
    await ensureCoordinatorAssignmentSchema()
    await ensureProjectsSchema()
    assignmentGuard = `
      and not exists (select 1 from public.program_coordinator_assignments where faculty_user_id=$3)
      and not exists (
        select 1 from public.groups g join public.projects p on p.id=g.project_id
        where g.adviser_user_id=$3 and not p.is_archived
      )`
  }
  const result = await getDb().query(`update users set faculty_verification_status=$4,
    faculty_reviewed_by=$1, faculty_reviewed_at=now(), faculty_rejection_reason=$5,
    active_session_id=case when $4='revoked' then null else active_session_id end
    where microsoft_user_id=$3 and tenant_id=$2 and role='faculty' and faculty_verification_status=$6
    ${assignmentGuard}
    returning microsoft_user_id`, [input.reviewerId, input.tenantId, input.userId, status, input.status === "rejected" ? input.reason : null, source])
  return (result.rowCount ?? 0) > 0
}

export async function resubmitFacultyVerification(userId: string, tenantId: string) {
  await ensureMicrosoftLoginSchema()
  // One atomic write checks status and quota, including simultaneous requests.
  const result = await getDb().query(`update users set faculty_verification_status='pending',
    faculty_reviewed_by=null, faculty_reviewed_at=null, faculty_rejection_reason=null,
    faculty_requested_at=now(),
    faculty_submission_attempts=array(select attempt from unnest(faculty_submission_attempts) as attempt
      where attempt > now()-interval '24 hours') || array[now()]
    where microsoft_user_id=$1 and tenant_id=$2 and role='faculty' and faculty_verification_status='rejected'
      and (select count(*) from unnest(faculty_submission_attempts) as attempt where attempt > now()-interval '24 hours') < 5
    returning microsoft_user_id`, [userId, tenantId])
  return (result.rowCount ?? 0) === 1
}
