import { getDb } from "@/lib/server-db"

export type AppNotification = {
  id: string
  type: string
  title: string
  message: string
  actorName: string | null
  href: string
  read: boolean
  createdAt: string
}

let schemaReady: Promise<unknown> | null = null

async function ensureSchema() {
  schemaReady ??= getDb().query(`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      recipient_user_id text not null references users(microsoft_user_id) on delete cascade,
      actor_user_id text references users(microsoft_user_id) on delete set null,
      project_id uuid references projects(id) on delete cascade,
      backlog_item_id uuid references backlog(id) on delete cascade,
      type text not null,
      title text not null,
      message text not null default '',
      href text not null default '/dashboard',
      dedupe_key text unique,
      is_read boolean not null default false,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index if not exists notifications_recipient_created_idx
      on notifications(recipient_user_id, created_at desc);
  `).catch((error) => { schemaReady = null; throw error })
  await schemaReady
}

export async function createNotification(input: {
  recipientUserId: string | null | undefined
  actorUserId?: string | null
  projectId?: string | null
  backlogItemId?: string | null
  type: string
  title: string
  message: string
  href?: string
  dedupeKey?: string | null
}) {
  if (!input.recipientUserId || input.recipientUserId === input.actorUserId) return
  try {
    await ensureSchema()
    await getDb().query(
      `insert into notifications (
         recipient_user_id, actor_user_id, project_id, backlog_item_id,
         type, title, message, href, dedupe_key
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (dedupe_key) do nothing`,
      [input.recipientUserId, input.actorUserId ?? null, input.projectId ?? null,
        input.backlogItemId ?? null, input.type, input.title, input.message,
        input.href ?? "/dashboard", input.dedupeKey ?? null]
    )
  } catch (error) {
    console.error("Failed to create notification", error)
  }
}

export async function notifyProjectAdvisers(input: {
  projectId: string
  actorUserId: string
  backlogItemId: string
  taskTitle: string
  actorName: string
  notificationType?: string
  notificationTitle?: string
  notificationMessage?: string
  dedupeKey?: string
}) {
  try {
    await ensureSchema()
    const recipients = await getDb().query<{ user_id: string }>(
    `select distinct user_id from (
       select g.adviser_user_id as user_id
       from groups g where g.project_id = $1 and g.adviser_user_id is not null
       union
       select u.microsoft_user_id
       from projects p
       join users u on u.name = any(p.project_adviser)
       where p.id = $1 and lower(u.role) in ('faculty', 'adviser')
     ) advisers where user_id is not null`,
    [input.projectId]
  )
    await Promise.all(recipients.rows.map(({ user_id }) => createNotification({
      recipientUserId: user_id,
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      backlogItemId: input.backlogItemId,
      type: input.notificationType ?? "student_work_submitted",
      title: input.notificationTitle ?? "Student task ready for review",
      message: input.notificationMessage ?? `${input.actorName} submitted work for “${input.taskTitle}”.`,
      href: `/dashboard/board?taskId=${encodeURIComponent(input.backlogItemId)}`,
      dedupeKey: input.dedupeKey
        ? `${input.dedupeKey}:${user_id}`
        : `student-work:${input.backlogItemId}:${user_id}`,
    })))
  } catch (error) {
    console.error("Failed to notify project advisers", error)
  }
}

async function createDueNotifications(userId: string) {
  await ensureSchema()
  await getDb().query(
    `insert into notifications (
       recipient_user_id, project_id, backlog_item_id, type, title, message, href, dedupe_key, created_at
     )
     select b.assignee_id, b.project_id, b.id, 'task_due', 'Task due date reached',
       'Your task “' || b.title || '” is due today or overdue.', '/dashboard/backlog',
       'task-due:' || b.id::text || ':' || b.due_date::text,
       greatest(now(), b.due_date::timestamptz)
     from backlog b
     where b.assignee_id = $1 and b.due_date is not null
       and b.due_date::date <= (now() at time zone 'Asia/Manila')::date
       and b.status <> 'completed' and b.is_archived = false and b.is_deleted = false
     on conflict (dedupe_key) do nothing`,
    [userId]
  )
}

export async function listNotifications(userId: string) {
  await createDueNotifications(userId)
  const result = await getDb().query<{
    id: string; type: string; title: string; message: string; actor_name: string | null; href: string
    is_read: boolean; created_at: string
  }>(
    `select n.id, n.type,
       case when n.type = 'journal_adviser_feedback' and n.project_id is not null
         then n.title || ' — ' || coalesce(
           (select nullif(g.group_name, '') from groups g where g.project_id = n.project_id limit 1),
           (select p.project_name from projects p where p.id = n.project_id limit 1),
           'Unknown group'
         )
         else n.title
       end as title,
       n.message, actor.name as actor_name,
       case when n.backlog_item_id is not null
         then '/dashboard/board?taskId=' || n.backlog_item_id::text
         else n.href
       end as href,
       n.is_read, n.created_at
     from notifications n
     left join users actor on actor.microsoft_user_id = n.actor_user_id
     where n.recipient_user_id = $1
     order by n.created_at desc limit 50`,
    [userId]
  )
  return result.rows.map((row) => ({
    id: row.id, type: row.type, title: row.title, message: row.message,
    actorName: row.actor_name,
    href: row.href, read: row.is_read,
    createdAt: new Date(row.created_at).toISOString(),
  })) satisfies AppNotification[]
}

export async function markNotificationRead(userId: string, id?: string) {
  await ensureSchema()
  await getDb().query(
    id
      ? `update notifications set is_read = true, read_at = now() where id = $1 and recipient_user_id = $2`
      : `update notifications set is_read = true, read_at = now() where recipient_user_id = $1 and is_read = false`,
    id ? [id, userId] : [userId]
  )
}
