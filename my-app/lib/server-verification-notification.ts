import { createNotification } from "@/lib/server-notification-repository"

export async function notifyVerificationDecision(input: {
  kind: "student" | "faculty"
  recipientUserId: string
  reviewerId: string
  status: "approved" | "rejected" | "revoked" | "restore"
  reason: string
  reviewedAt: string
}) {
  const approved = input.status === "approved"
  const restored = input.status === "restore"
  const revoked = input.status === "revoked"
  const label = input.kind === "student" ? "Student" : "Faculty"
  const type = approved ? "verification_approved" : restored ? "verification_restored"
    : revoked ? "verification_revoked" : "verification_declined"
  const contact = input.kind === "student" ? "your program coordinator" : "the Super Admin"
  const nextStep = input.kind === "student"
    ? "Sign in to TrackSphere, update your profile details, and resubmit your verification request."
    : "Contact the Super Admin if you need to confirm your eligibility, then sign in to TrackSphere to resubmit your verification request."

  await createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.reviewerId,
    type,
    title: restored ? "TrackSphere access restored" : revoked ? "TrackSphere access revoked"
      : `${label} verification ${approved ? "approved" : "declined"}`,
    message: approved
      ? "Your verification was approved. You can now sign in to TrackSphere with your school account and open your dashboard."
      : restored ? "Your access to TrackSphere has been restored. You can sign in again with your school account."
      : revoked ? `Your access to TrackSphere has been revoked. Contact ${contact} if you have questions or need access again.`
      : `Your verification request was declined.\n\nReason: ${input.reason}\n\n${nextStep}`,
    href: approved || restored ? "/dashboard" : `/${input.kind}-verification`,
    dedupeKey: `${type}:${input.kind}:${input.recipientUserId}:${input.reviewedAt}`,
  })
}
