import { getDb } from "@/lib/server-db"
import { ensureMicrosoftLoginSchema } from "@backend/repositories/users-repository"

export type FacultyVerification = {
  userId: string; name: string; email: string; status: "pending" | "approved" | "rejected"
  submittedAt: string; reason: string | null
}
export async function getFacultyAccessState(userId: string) {
  await ensureMicrosoftLoginSchema()
  const result = await getDb().query<{ status: string; reason: string | null }>(
    `select faculty_verification_status as status, faculty_rejection_reason as reason
     from users where microsoft_user_id=$1 order by login_at desc limit 1`, [userId])
  return result.rows[0] ?? { status: "pending", reason: null }
}
export async function listFacultyVerifications(tenantId: string) {
  await ensureMicrosoftLoginSchema()
  const result = await getDb().query<FacultyVerification>(`
    select distinct on (microsoft_user_id) microsoft_user_id as "userId", name, email,
      faculty_verification_status as status, login_at::text as "submittedAt", faculty_rejection_reason as reason
    from users where tenant_id=$1 and role='faculty'
    order by microsoft_user_id, login_at desc`, [tenantId])
  return result.rows
}
export async function reviewFacultyVerification(input: { userId: string; tenantId: string; reviewerId: string; status: "approved" | "rejected"; reason: string }) {
  await ensureMicrosoftLoginSchema()
  const result = await getDb().query(`update users set faculty_verification_status=$4,
    faculty_reviewed_by=$1, faculty_reviewed_at=now(), faculty_rejection_reason=$5
    where microsoft_user_id=$3 and tenant_id=$2 and role='faculty' and faculty_verification_status='pending'
    returning microsoft_user_id`, [input.reviewerId, input.tenantId, input.userId, input.status, input.status === "rejected" ? input.reason : null])
  return (result.rowCount ?? 0) > 0
}
