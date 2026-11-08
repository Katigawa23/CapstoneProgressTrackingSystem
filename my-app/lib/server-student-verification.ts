import { getDb } from "@/lib/server-db"
import { ensureStudentProfileSchema } from "@/lib/server-student-profile"
import { ensureCoordinatorAssignmentSchema } from "@/lib/server-coordinator-assignments"

export type StudentVerification = {
  userId: string; name: string; email: string; program: string; yearLevel: string
  status: "pending" | "approved" | "rejected"; submittedAt: string; reason: string | null
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
  coordinatorId: string; tenantId: string; studentId: string; status: "approved" | "rejected"; reason: string
}) {
  await ensureCoordinatorAssignmentSchema()
  await ensureStudentProfileSchema()
  // Scope and pending-state checks are part of the write, including concurrent reviews.
  const result = await getDb().query(`
    update public.student_profiles p set verification_status=$4, rejection_reason=$5,
      reviewed_by_user_id=$1, reviewed_at=now()
    from public.users u, public.program_coordinator_assignments a
    where p.user_id=$3 and u.microsoft_user_id=p.user_id and u.tenant_id=$2
      and u.role='student' and u.student_profile_required=true
      and a.program_option_id=p.program_option_id and a.faculty_user_id=$1
      and p.verification_status='pending'
    returning p.user_id`,
    [input.coordinatorId, input.tenantId, input.studentId, input.status,
      input.status === "rejected" ? input.reason : null])
  return (result.rowCount ?? 0) === 1
}
