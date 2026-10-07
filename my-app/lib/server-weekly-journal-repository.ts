import { getDb } from "@/lib/server-db"

export type WeeklyJournalStatus = "draft" | "submitted" | "approved"

export type WeeklyJournalEntry = {
  id: string
  projectId: string
  weekNumber: number
  weeklyObjectives: string
  workCompleted: string
  memberContributions: string
  challenges: string
  actionsTaken: string
  nextWeekPlan: string
  adviserFeedback: string
  adviserReviewedAt: string | null
  status: WeeklyJournalStatus
  submittedAt: string | null
  approvedAt: string | null
  updatedAt: string
}

export type WeeklyJournalAutoSummary = {
  weekNumber: number
  weeklyObjectives: string
  workCompleted: string
  memberContributions: string
  challenges: string
  actionsTaken: string
  nextWeekPlan: string
  tasksCreated: number
  tasksCompleted: number
  revisions: number
  delayed: number
}

type JournalInput = Omit<
  WeeklyJournalEntry,
  "id" | "projectId" | "weekNumber" | "status" | "submittedAt" | "approvedAt" | "updatedAt" | "adviserFeedback" | "adviserReviewedAt"
>

let schemaReady: Promise<unknown> | null = null

async function ensureSchema() {
  schemaReady ??= getDb().query(`
    create table if not exists weekly_journals (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references projects(id) on delete cascade,
      week_number integer not null check (week_number > 0),
      weekly_objectives text not null default '',
      work_completed text not null default '',
      member_contributions text not null default '',
      challenges text not null default '',
      actions_taken text not null default '',
      next_week_plan text not null default '',
      student_reflection text not null default '',
      adviser_feedback text not null default '',
      adviser_reviewed_by_user_id text references users(microsoft_user_id) on delete set null,
      adviser_reviewed_at timestamptz,
      status text not null default 'draft' check (status in ('draft', 'submitted', 'revision', 'approved')),
      created_by_user_id text references users(microsoft_user_id) on delete set null,
      submitted_at timestamptz,
      approved_by_user_id text references users(microsoft_user_id) on delete set null,
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (project_id, week_number)
    );
    create index if not exists weekly_journals_project_idx
      on weekly_journals(project_id, week_number);
    alter table weekly_journals
      add column if not exists adviser_reviewed_by_user_id text references users(microsoft_user_id) on delete set null;
    alter table weekly_journals
      add column if not exists adviser_reviewed_at timestamptz;
    update weekly_journals set status = 'submitted' where status = 'revision';

    create table if not exists task_activity_events (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references projects(id) on delete cascade,
      backlog_item_id uuid not null references backlog(id) on delete cascade,
      event_type text not null,
      old_value text,
      new_value text,
      occurred_at timestamptz not null default now()
    );
    create index if not exists task_activity_events_project_time_idx
      on task_activity_events(project_id, occurred_at desc);

    create or replace function record_backlog_activity_event()
    returns trigger language plpgsql as $$
    begin
      if tg_op = 'INSERT' then
        insert into task_activity_events(project_id, backlog_item_id, event_type, new_value)
        values (new.project_id, new.id, 'created', new.title);
      else
        if old.status is distinct from new.status then
          insert into task_activity_events(project_id, backlog_item_id, event_type, old_value, new_value)
          values (new.project_id, new.id, 'status', old.status, new.status);
        end if;
        if old.assignee_id is distinct from new.assignee_id then
          insert into task_activity_events(project_id, backlog_item_id, event_type, old_value, new_value)
          values (new.project_id, new.id, 'assignee', old.assignee_id, new.assignee_id);
        end if;
        if old.priority is distinct from new.priority then
          insert into task_activity_events(project_id, backlog_item_id, event_type, old_value, new_value)
          values (new.project_id, new.id, 'priority', old.priority, new.priority);
        end if;
      end if;
      return new;
    end $$;
    do $$ begin
      if not exists (
        select 1 from pg_trigger where tgname = 'backlog_activity_event_trigger'
      ) then
        create trigger backlog_activity_event_trigger
          after insert or update of status, assignee_id, priority on backlog
          for each row execute function record_backlog_activity_event();
      end if;
    end $$;
  `)
  return schemaReady
}

function mapEntry(row: Record<string, unknown>): WeeklyJournalEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    weekNumber: Number(row.week_number),
    weeklyObjectives: String(row.weekly_objectives ?? ""),
    workCompleted: String(row.work_completed ?? ""),
    memberContributions: String(row.member_contributions ?? ""),
    challenges: String(row.challenges ?? ""),
    actionsTaken: String(row.actions_taken ?? ""),
    nextWeekPlan: String(row.next_week_plan ?? ""),
    adviserFeedback: String(row.adviser_feedback ?? ""),
    adviserReviewedAt: row.adviser_reviewed_at ? new Date(String(row.adviser_reviewed_at)).toISOString() : null,
    status: row.status as WeeklyJournalStatus,
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
    approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : null,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}

export async function canAccessJournal(projectId: string, userId: string, role: string) {
  if (role === "admin") return true
  const result = await getDb().query(
    `select 1 from projects p
     left join groups g on g.project_id = p.id
     where p.id = $1 and (
       p.owner_user_id = $2 or $2 = any(p.member_user_ids) or
       $2 = any(coalesce(g.member_user_ids, '{}')) or g.adviser_user_id = $2 or
       exists (
         select 1 from users adviser
         where adviser.microsoft_user_id = $2
           and adviser.name = any(p.project_adviser)
       )
     ) limit 1`,
    [projectId, userId]
  )
  return result.rowCount === 1
}

export async function listWeeklyJournals(projectId: string) {
  await ensureSchema()
  const result = await getDb().query(
    `select * from weekly_journals where project_id = $1 order by week_number`,
    [projectId]
  )
  return result.rows.map(mapEntry)
}

export async function listWeeklyJournalAutoSummaries(projectId: string) {
  const projectResult = await getDb().query<{ created_at: string }>(
    `select created_at from projects where id = $1`, [projectId]
  )
  if (!projectResult.rows[0]) return []

  const dayMs = 24 * 60 * 60 * 1000
  const manilaOffsetMs = 8 * 60 * 60 * 1000
  const rawStartMs = new Date(projectResult.rows[0].created_at).getTime()
  const startMs = Math.floor((rawStartMs + manilaOffsetMs) / dayMs) * dayMs
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const weekOf = (value: string | null) => value
    ? Math.max(1, Math.floor((new Date(value).getTime() + manilaOffsetMs - startMs) / weekMs) + 1)
    : 1
  await ensureSchema()
  const [tasksResult, commentsResult, attachmentsResult, linksResult, eventsResult] = await Promise.all([
    getDb().query(`select b.*, coalesce(u.name, b.assignee_id, 'Unassigned') as assignee_name
      from backlog b left join users u on u.microsoft_user_id = b.assignee_id
      where b.project_id = $1 and b.is_deleted = false`, [projectId]),
    getDb().query(`select c.created_at, c.author, c.body, b.title
      from comments c join backlog b on b.id = c.backlog_item_id
      where b.project_id = $1`, [projectId]),
    getDb().query(`select a.uploaded_at, a.file_name, coalesce(u.name, a.uploaded_by_user_id, 'A member') as actor, b.title
      from attachments a join backlog b on b.id = a.backlog_item_id
      left join users u on u.microsoft_user_id = a.uploaded_by_user_id
      where b.project_id = $1 and a.is_archived = false and a.is_deleted = false`, [projectId]),
    getDb().query(`select w.uploaded_at, coalesce(nullif(w.label, ''), w.url) as label,
      coalesce(u.name, w.uploaded_by_user_id, 'A member') as actor, b.title
      from weblinks w join backlog b on b.id = w.backlog_item_id
      left join users u on u.microsoft_user_id = w.uploaded_by_user_id
      where b.project_id = $1 and w.is_archived = false and w.is_deleted = false`, [projectId]),
    getDb().query(`select e.event_type, e.old_value, e.new_value, e.occurred_at,
      b.title, coalesce(u.name, b.assignee_id, 'Unassigned') as assignee_name
      from task_activity_events e join backlog b on b.id = e.backlog_item_id
      left join users u on u.microsoft_user_id = b.assignee_id
      where e.project_id = $1 order by e.occurred_at`, [projectId]),
  ])
  type SummaryTextKey = "weeklyObjectives" | "workCompleted" | "memberContributions" |
    "challenges" | "actionsTaken" | "nextWeekPlan"
  const summaries = new Map<number, Record<SummaryTextKey, string[]>>()
  const getWeek = (week: number) => {
    if (!summaries.has(week)) summaries.set(week, {
      weeklyObjectives: [], workCompleted: [], memberContributions: [], challenges: [],
      actionsTaken: [], nextWeekPlan: [],
    })
    return summaries.get(week)!
  }
  const today = Date.now()
  const currentWeek = Math.max(1, Math.floor((today + manilaOffsetMs - startMs) / weekMs) + 1)
  const formatEventDate = (value: string) => new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value))

  for (const row of tasksResult.rows) {
    const createdWeek = weekOf(row.created_at)
    const dueWeek = weekOf(row.due_date ?? row.created_at)
    getWeek(createdWeek).weeklyObjectives.push(`${row.title} — ${row.priority} priority, due ${row.due_date ? formatEventDate(row.due_date) : "not set"}`)
    getWeek(createdWeek).actionsTaken.push(`Task created: ${row.title} — ${formatEventDate(row.created_at)}`)
    if (row.assignee_id) getWeek(createdWeek).memberContributions.push(`${row.assignee_name}: assigned to ${row.title}`)
    const hasStatusEvent = eventsResult.rows.some((event) => event.title === row.title && event.event_type === "status")
    if (row.status === "completed" && !hasStatusEvent) getWeek(dueWeek).workCompleted.push(`${row.title} — ${row.assignee_name}`)
    if (row.status === "revision" && !hasStatusEvent) {
      getWeek(currentWeek).challenges.push(`Revision required: ${row.title}`)
      if (row.assignee_id) getWeek(currentWeek).memberContributions.push(`${row.assignee_name}: working on revision for ${row.title}`)
    }
    if (row.due_date && new Date(row.due_date).getTime() < today && row.status !== "completed") {
      getWeek(currentWeek).challenges.push(`Delayed task: ${row.title}`)
    }
    if (dueWeek === currentWeek + 1 && row.status !== "completed") getWeek(currentWeek).nextWeekPlan.push(row.title)
  }
  for (const row of eventsResult.rows) {
    const week = weekOf(row.occurred_at)
    const when = formatEventDate(row.occurred_at)
    if (row.event_type === "status" && row.new_value === "completed") {
      getWeek(week).workCompleted.push(`${row.title} — completed by ${row.assignee_name}, ${when}`)
    } else if (row.event_type === "status" && row.new_value === "revision") {
      getWeek(week).challenges.push(`Revision required: ${row.title} — ${when}`)
      getWeek(week).memberContributions.push(`${row.assignee_name}: assigned to revise ${row.title}`)
    } else if (row.event_type === "assignee") {
      getWeek(week).actionsTaken.push(`${row.title} was reassigned to ${row.assignee_name} — ${when}`)
    } else if (row.event_type === "priority") {
      getWeek(week).actionsTaken.push(`${row.title} priority changed to ${row.new_value} — ${when}`)
    }
  }
  for (const row of commentsResult.rows) {
    const week = weekOf(row.created_at)
    getWeek(week).actionsTaken.push(`${row.author} commented on ${row.title}: ${String(row.body).slice(0, 160)}`)
  }
  for (const row of attachmentsResult.rows) {
    const week = weekOf(row.uploaded_at)
    getWeek(week).actionsTaken.push(`${row.actor} uploaded ${row.file_name} to ${row.title}`)
    getWeek(week).memberContributions.push(`${row.actor}: submitted evidence for ${row.title}`)
  }
  for (const row of linksResult.rows) {
    const week = weekOf(row.uploaded_at)
    getWeek(week).actionsTaken.push(`${row.actor} added ${row.label} to ${row.title}`)
  }
  const uniqueLines = (lines: string[]) => [...new Set(lines)].map((line) => `• ${line}`).join("\n")
  return [...summaries.entries()].map(([weekNumber, values]) => ({
    weekNumber,
    weeklyObjectives: uniqueLines(values.weeklyObjectives),
    workCompleted: uniqueLines(values.workCompleted),
    memberContributions: uniqueLines(values.memberContributions),
    challenges: uniqueLines(values.challenges),
    actionsTaken: uniqueLines(values.actionsTaken),
    nextWeekPlan: uniqueLines(values.nextWeekPlan),
    tasksCreated: tasksResult.rows.filter((row) => weekOf(row.created_at) === weekNumber).length,
    tasksCompleted: values.workCompleted.length,
    revisions: values.challenges.filter((line) => line.startsWith("Revision required:")).length,
    delayed: values.challenges.filter((line) => line.startsWith("Delayed task:")).length,
  }))
}

export async function saveWeeklyJournal(
  projectId: string,
  weekNumber: number,
  userId: string,
  input: JournalInput,
  submit: boolean
) {
  await ensureSchema()
  const status = submit ? "submitted" : "draft"
  const result = await getDb().query(
    `insert into weekly_journals (
       project_id, week_number, weekly_objectives, work_completed, member_contributions,
       challenges, actions_taken, next_week_plan, status,
       created_by_user_id, submitted_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,case when $9 = 'submitted' then now() else null end,now())
     on conflict (project_id, week_number) do update set
       weekly_objectives = excluded.weekly_objectives,
       work_completed = excluded.work_completed,
       member_contributions = excluded.member_contributions,
       challenges = excluded.challenges,
       actions_taken = excluded.actions_taken,
       next_week_plan = excluded.next_week_plan,
       status = excluded.status,
       submitted_at = case when excluded.status = 'submitted' then now() else weekly_journals.submitted_at end,
       adviser_reviewed_by_user_id = null,
       adviser_reviewed_at = null,
       approved_at = null, approved_by_user_id = null, updated_at = now()
     where weekly_journals.status = 'draft'
     returning *`,
    [projectId, weekNumber, input.weeklyObjectives, input.workCompleted,
      input.memberContributions, input.challenges, input.actionsTaken,
      input.nextWeekPlan, status, userId]
  )
  return result.rows[0] ? mapEntry(result.rows[0]) : null
}

export async function reviewWeeklyJournal(
  projectId: string,
  weekNumber: number,
  action: "feedback" | "approve",
  feedback: string,
  userId: string
) {
  await ensureSchema()
  const status = action === "approve" ? "approved" : null
  const isAdviserReview = action !== "approve"
  if (isAdviserReview) {
    await getDb().query(
      `insert into weekly_journals (project_id, week_number, status, created_by_user_id, submitted_at)
       values ($1, $2, 'submitted', $3, now())
       on conflict (project_id, week_number) do update set
         status = 'submitted',
         submitted_at = coalesce(weekly_journals.submitted_at, now()),
         updated_at = now()
       where weekly_journals.status = 'draft'`,
      [projectId, weekNumber, userId]
    )
  }
  const result = await getDb().query(
    `update weekly_journals set
       adviser_feedback = case when $6 then $3 else adviser_feedback end,
       status = coalesce($4, status),
       adviser_reviewed_by_user_id = case when $6 then $5 else adviser_reviewed_by_user_id end,
       adviser_reviewed_at = case when $6 then now() else adviser_reviewed_at end,
       approved_by_user_id = case when $4 = 'approved' then $5 else approved_by_user_id end,
       approved_at = case when $4 = 'approved' then now() else approved_at end,
       updated_at = now()
     where project_id = $1 and week_number = $2
       and (
         ($4 = 'approved' and status = 'submitted' and adviser_reviewed_at is not null) or
         ($4 is null and status = 'submitted' and adviser_reviewed_at is null)
       )
     returning *`,
    [projectId, weekNumber, feedback, status, userId, isAdviserReview]
  )
  return result.rows[0] ? mapEntry(result.rows[0]) : null
}
