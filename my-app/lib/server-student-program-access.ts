import { getDb } from "@/lib/server-db"
import { ensureStudentProfileSchema } from "@/lib/server-student-profile"
import { ensureCoordinatorAssignmentSchema } from "@/lib/server-coordinator-assignments"
import type { RegisteredMicrosoftUser } from "@backend/repositories/users-repository"

export async function searchCoordinatorStudents(coordinatorId: string, tenantId: string, query: string): Promise<RegisteredMicrosoftUser[]> {
  await ensureCoordinatorAssignmentSchema()
  await ensureStudentProfileSchema()
  const result = await getDb().query<RegisteredMicrosoftUser>(`
    select distinct u.microsoft_user_id as id, u.name, u.email, u.role,
      u.tenant_id as "tenantId", u.login_at::text as "loginAt"
    from users u join student_profiles p on p.user_id=u.microsoft_user_id
    join program_coordinator_assignments a on a.program_option_id=p.program_option_id
    where a.faculty_user_id=$1 and u.tenant_id=$2 and u.role='student'
      and (not u.student_profile_required or p.verification_status='approved')
      and ($3='' or u.name ilike $4 or u.email ilike $4)
    order by u.name, u.email limit 20`, [coordinatorId, tenantId, query.trim(), `%${query.trim()}%`])
  return result.rows
}

export async function canAssignStudentsToProgram(coordinatorId: string, tenantId: string, program: string, studentIds: string[]) {
  await ensureCoordinatorAssignmentSchema()
  await ensureStudentProfileSchema()
  if (!studentIds.length) return false
  const result = await getDb().query<{ id: string }>(`
    select distinct u.microsoft_user_id as id from users u
    join student_profiles p on p.user_id=u.microsoft_user_id
    join project_configuration_options o on o.id=p.program_option_id and o.category='program'
    join program_coordinator_assignments a on a.program_option_id=o.id
    where u.microsoft_user_id=any($4::text[]) and u.tenant_id=$2 and u.role='student'
      and a.faculty_user_id=$1 and lower(o.label)=lower($3)
      and (not u.student_profile_required or p.verification_status='approved')`,
    [coordinatorId, tenantId, program, studentIds])
  const allowed = new Set(result.rows.map((row) => row.id))
  return studentIds.every((id) => allowed.has(id))
}
