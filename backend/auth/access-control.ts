export const SUPER_ADMIN_VIEWER_ID = "tester-admin"

export function isSuperAdminViewer(userId: string | null | undefined) {
  return userId?.trim() === SUPER_ADMIN_VIEWER_ID
}
