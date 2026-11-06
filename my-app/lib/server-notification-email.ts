import nodemailer from "nodemailer"
import { getDb } from "@/lib/server-db"

export const emailNotificationTypes = new Set([
  "task_assigned", "student_file_submitted", "student_link_submitted",
  "task_approved", "task_revision_requested",
  "coordinator_assigned", "coordinator_removed", "adviser_assigned",
  "journal_submitted", "journal_adviser_feedback",
])

export const notificationEmailSchema = `
  create table if not exists notification_email_deliveries (
    notification_id uuid primary key references notifications(id) on delete cascade,
    status text not null default 'pending'
      check (status in ('pending', 'sending', 'sent', 'failed', 'uncertain', 'cancelled')),
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error text,
    sent_at timestamptz,
    created_at timestamptz not null default now()
  );
  create index if not exists notification_email_pending_idx
    on notification_email_deliveries(next_attempt_at, created_at)
    where status in ('pending', 'failed');
`

export function getTaskEmailConfiguration() {
  const user = process.env.SMTP_USER?.trim() ?? ""
  const pass = process.env.SMTP_PASS?.replace(/\s/g, "") ?? ""
  const appUrl = process.env.APP_URL?.trim() ?? ""
  const missing = [!user && "SMTP_USER", !pass && "SMTP_PASS", !appUrl && "APP_URL"].filter(Boolean)
  return { enabled: process.env.TASK_EMAIL_ENABLED === "true", user, pass, appUrl, missing }
}

type EmailNotification = {
  id: string; type: string; title: string; message: string
  recipient_email: string; recipient_name: string; recipient_user_id: string
  task_title: string | null; description: string | null; priority: string | null
  due_date: string | null; project_name: string | null; assignee_id: string | null
  task_status: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}

export function buildTaskNotificationEmail(notification: EmailNotification, appUrl: string) {
  const origin = new URL(appUrl)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
    (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) {
    throw new Error("INVALID_APP_URL")
  }
  const link = new URL("/api/notifications/email/open", origin.origin)
  link.searchParams.set("notificationId", notification.id)
  const buttonLabel = notification.type.startsWith("journal_") ? "View weekly journal"
    : notification.type.startsWith("coordinator_") ? "View dashboard"
    : notification.type === "adviser_assigned" ? "View group" : "View task"
  const details = [
    ["Task", notification.task_title], ["Group / project", notification.project_name],
    ["Priority", notification.priority], ["Due date", notification.due_date],
  ].filter((entry) => entry[1])
  const text = [
    `Hello ${notification.recipient_name},`, notification.message,
    ...details.map(([label, value]) => `${label}: ${value}`),
    notification.description ? `Description: ${notification.description}` : "",
    `${buttonLabel}: ${link.href}`, "This is an automatic notification from TrackSphere.",
  ].filter(Boolean).join("\n\n")
  const html = `<div style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dbe3eb;border-radius:10px;overflow:hidden">
      <div style="background:#0b5d96;color:#fff;padding:20px;font-size:22px;font-weight:bold">TrackSphere</div>
      <div style="padding:24px;color:#172b4d"><h2>${escapeHtml(notification.title)}</h2>
      <p>Hello ${escapeHtml(notification.recipient_name)},</p><p>${escapeHtml(notification.message)}</p>
      <table style="width:100%;font-size:14px">${details.map(([label, value]) =>
        `<tr><td style="padding:8px 0;color:#64748b">${escapeHtml(label!)}</td><td>${escapeHtml(value!)}</td></tr>`).join("")}</table>
      ${notification.description ? `<p style="white-space:pre-wrap">${escapeHtml(notification.description)}</p>` : ""}
      <p style="margin:24px 0"><a href="${escapeHtml(link.href)}" style="background:#0b5d96;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">${buttonLabel}</a></p>
      <p style="font-size:12px;color:#64748b">Sign in with your school account to view this update. This is an automatic notification from TrackSphere.</p>
      </div></div></div>`
  return { subject: `[TrackSphere] ${notification.title.replace(/[\r\n]/g, " ")}`, text, html }
}

export async function processPendingTaskEmails(limit = 5) {
  const configuration = getTaskEmailConfiguration()
  if (!configuration.enabled || configuration.missing.length) {
    return { configured: false, processed: 0, sent: 0, failed: 0 }
  }
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: configuration.user, pass: configuration.pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  })
  const counts = { configured: true, processed: 0, sent: 0, failed: 0 }
  for (let index = 0; index < Math.max(1, Math.min(limit, 10)); index++) {
    const claim = await getDb().query<{ notification_id: string }>(`
      with candidate as (
        select notification_id from notification_email_deliveries
        where status in ('pending', 'failed') and attempts < 3 and next_attempt_at <= now()
        order by created_at limit 1 for update skip locked
      ) update notification_email_deliveries d
        set status = 'sending', attempts = attempts + 1, last_error = null
        from candidate where d.notification_id = candidate.notification_id
        returning d.notification_id
    `)
    const id = claim.rows[0]?.notification_id
    if (!id) break
    counts.processed++
    let accepted = false
    let smtpStarted = false
    try {
      const result = await getDb().query<EmailNotification>(`
        select n.id, n.type, n.title, n.message, n.recipient_user_id,
          recipient.email as recipient_email, recipient.name as recipient_name,
          b.title as task_title, b.description, b.priority, b.due_date::text,
          b.assignee_id, b.status as task_status,
          coalesce((select nullif(g.group_name, '') from groups g where g.project_id = p.id limit 1), p.project_name) as project_name
        from notifications n
        join lateral (select email, name from users where microsoft_user_id = n.recipient_user_id
          order by login_at desc limit 1) recipient on true
        left join backlog b on b.id = n.backlog_item_id and not b.is_archived and not b.is_deleted
        left join projects p on p.id = n.project_id
        where n.id = $1 and (
          (n.type in ('task_assigned', 'task_approved', 'task_revision_requested') and b.assignee_id = n.recipient_user_id)
          or (n.type in ('student_file_submitted', 'student_link_submitted') and b.id is not null and (
            recipient.name = any(p.project_adviser)
            or exists (select 1 from groups g where g.project_id = p.id and g.adviser_user_id = n.recipient_user_id)
          ))
          or (n.type in ('adviser_assigned', 'journal_submitted') and (
            recipient.name = any(p.project_adviser)
            or exists (select 1 from groups g where g.project_id = p.id and g.adviser_user_id = n.recipient_user_id)
          ))
          or (n.type = 'journal_adviser_feedback' and (
            n.recipient_user_id = any(p.member_user_ids)
            or exists (select 1 from groups g where g.project_id = p.id
              and n.recipient_user_id = any(g.member_user_ids))
          ))
          or (n.type in ('coordinator_assigned', 'coordinator_removed') and n.project_id is null)
        )
      `, [id])
      const notification = result.rows[0]
      if (!notification || !emailNotificationTypes.has(notification.type) ||
        (notification.type === 'task_approved' && notification.task_status !== 'completed') ||
        (notification.type === 'task_revision_requested' && notification.task_status !== 'revision') ||
        (['task_assigned', 'task_approved', 'task_revision_requested'].includes(notification.type) &&
          notification.assignee_id !== notification.recipient_user_id)) {
        await getDb().query("update notification_email_deliveries set status = 'cancelled' where notification_id = $1", [id])
        continue
      }
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(notification.recipient_email)) throw new Error("INVALID_RECIPIENT")
      const message = buildTaskNotificationEmail(notification, configuration.appUrl)
      smtpStarted = true
      const receipt = await transport.sendMail({
        from: { name: "TrackSphere Notifications", address: configuration.user },
        to: notification.recipient_email,
        messageId: `<tracksphere-${id}@${configuration.user.split('@')[1]}>`,
        ...message,
      })
      if (!receipt.accepted?.length) throw Object.assign(new Error("RECIPIENT_REJECTED"), { code: "EENVELOPE", responseCode: 550 })
      accepted = true
      await getDb().query("update notification_email_deliveries set status = 'sent', sent_at = now() where notification_id = $1", [id])
      counts.sent++
    } catch (error) {
      const smtpError = error as { code?: string; command?: string; responseCode?: number }
      // Unconfirmed network failures after handing a message to SMTP must not automatically resend.
      const uncertain = accepted || (smtpStarted && !smtpError.responseCode &&
        !['EAUTH', 'EDNS', 'ENOTFOUND'].includes(smtpError.code ?? ''))
      await getDb().query(`update notification_email_deliveries set status = $2,
        last_error = $3, next_attempt_at = now() + interval '5 minutes' where notification_id = $1`,
      [id, uncertain ? "uncertain" : "failed", smtpError.code ?? "EMAIL_DELIVERY_FAILED"])
      counts.failed++
      console.error("Task email delivery did not complete", { notificationId: id, uncertain, code: smtpError.code ?? "EMAIL_DELIVERY_FAILED" })
    }
  }
  return counts
}
