import { getDb } from "@/lib/server-db"
import { ensureActiveSessionSchema } from "@/lib/server-active-session"
import { ensureStudentProfileSchema } from "@/lib/server-student-profile"
import { ensureCoordinatorAssignmentSchema } from "@/lib/server-coordinator-assignments"

export type StudentVerification = {
  userId: string; name: string; email: string; program: string; yearLevel: string
  status: "pending" | "approved" | "rejected" | "revoked"; submittedAt: string; reason: string | null
}

export async function listStudentVerifications(coordinatorId: string, tenantId: string) {
  await ensureCoordinatorAssignmentSchema()
  await ensureStudentProfileSchema()
  const result = await getDb().query<StudentVerification>(`
    select p.user_id as "userId", u.name, u.email, o.label as program,
      p.year_level as "yearLevel", p.verification_status as status,
      p.updated_at::text as "submittedAt", p.rejection_reason as reason
    from public.student_profiles p
    join public.users u on u.microsoft_user_id=p.user_id
    join public.project_configuration_options o on o.id=p.program_option_id and o.category='program'
    join public.program_coordinator_assignments a on a.program_option_id=o.id
    where a.faculty_user_id=$1 and u.tenant_id=$2 and u.role='student' and u.student_profile_required=true
    order by case when p.verification_status='pending' then 0 else 1 end, p.updated_at desc`,
    [coordinatorId, tenantId])
  return result.rows
}

export async function reviewStudentVerification(input: {
  coordinatorId: string; tenantId: string; studentId: string; status: "approved" | "rejected" | "revoked" | "restore"; reason: string
}) {
  await ensureCoordinatorAssignmentSchema()
  await ensureStudentProfileSchema()
  await ensureActiveSessionSchema()
  const source = input.status === "restore" ? "revoked" : input.status === "revoked" ? "approved" : "pending"
  const status = input.status === "restore" ? "approved" : input.status
  const result = await getDb().query<{ reviewedAt: string }>(`
    with target as (
      select microsoft_user_id from public.users
      where microsoft_user_id=$3 and tenant_id=$2
        and role='student' and student_profile_required=true
      for update
    ), reviewed as (
    update public.student_profiles p set verification_status=$4, rejection_reason=$5,
      reviewed_by_user_id=$1, reviewed_at=now()
    from target, public.program_coordinator_assignments a
    where p.user_id=target.microsoft_user_id
      and a.program_option_id=p.program_option_id and a.faculty_user_id=$1
      and p.verification_status=$6
    returning p.user_id, p.reviewed_at::text as "reviewedAt"
    ), signed_out as (
      update public.users u set active_session_id=null from reviewed
      where u.microsoft_user_id=reviewed.user_id and $4='revoked'
    )
    select "reviewedAt" from reviewed`,
    [input.coordinatorId, input.tenantId, input.studentId, status,
      input.status === "rejected" ? input.reason : null, source])
  return result.rows[0] ?? null
}
