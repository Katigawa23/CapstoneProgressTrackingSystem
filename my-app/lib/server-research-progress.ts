import { getDb } from "@/lib/server-db"

let schemaReady: Promise<unknown> | undefined

export function ensureResearchProgressSchema() {
  schemaReady ??= getDb().query(`
    select pg_advisory_xact_lock(817293006);
    create table if not exists task_research_progress (
      id bigint generated always as identity primary key,
      task_id uuid not null references backlog(id) on delete cascade,
      target integer not null check (target between 1 and 1000000),
      completed integer not null check (completed between 0 and target),
      recorded_by text not null references users(microsoft_user_id),
      recorded_at timestamptz not null default clock_timestamp()
    );
    create index if not exists task_research_progress_task_order_idx
      on task_research_progress(task_id, id desc);
    create table if not exists task_surveys (
      task_id uuid primary key references backlog(id) on delete cascade,
      token uuid not null unique default gen_random_uuid(),
      title text not null,
      purpose text not null,
      questions jsonb not null,
      published_by text references users(microsoft_user_id),
      published_at timestamptz,
      closed_at timestamptz
    );
    create table if not exists task_survey_responses (
      task_id uuid not null references task_surveys(task_id) on delete cascade,
      submission_id uuid not null,
      answers jsonb not null,
      submitted_at timestamptz not null default clock_timestamp(),
      primary key (task_id, submission_id)
    );
    create index if not exists task_survey_responses_recent_idx
      on task_survey_responses(task_id, submitted_at desc, submission_id);
    alter table task_surveys add column if not exists configuration jsonb not null default '{}';
    alter table task_survey_responses
      add column if not exists email text,
      add column if not exists respondent_user_id text;
    create unique index if not exists task_survey_one_respondent_idx
      on task_survey_responses(task_id, respondent_user_id) where respondent_user_id is not null;
    create table if not exists task_survey_files (
      id uuid primary key default gen_random_uuid(),
      task_id uuid not null,
      submission_id uuid not null,
      question_index integer not null,
      name text not null,
      content_type text not null,
      content bytea not null,
      foreign key (task_id, submission_id) references task_survey_responses(task_id, submission_id) on delete cascade
    );
    create index if not exists task_survey_files_response_idx on task_survey_files(task_id, submission_id);
    alter table task_surveys add column if not exists created_at timestamptz not null default clock_timestamp();
    do $survey_migration$
    begin
      if not exists (
        select 1 from pg_attribute where attrelid = 'task_survey_responses'::regclass
          and attname = 'survey_token' and not attisdropped
      ) then
        alter table task_survey_responses add column survey_token uuid;
        alter table task_survey_files add column survey_token uuid;
        update task_survey_responses r set survey_token=s.token from task_surveys s where r.task_id=s.task_id;
        update task_survey_files f set survey_token=s.token from task_surveys s where f.task_id=s.task_id;
        alter table task_survey_files drop constraint task_survey_files_task_id_submission_id_fkey;
        alter table task_survey_responses drop constraint task_survey_responses_task_id_fkey;
        alter table task_survey_responses drop constraint task_survey_responses_pkey;
        alter table task_surveys drop constraint task_surveys_pkey;
        alter table task_surveys add primary key (token);
        alter table task_surveys add unique (task_id, token);
        alter table task_survey_responses alter column survey_token set not null;
        alter table task_survey_responses add primary key (task_id, survey_token, submission_id);
        alter table task_survey_responses add foreign key (task_id, survey_token) references task_surveys(task_id, token) on delete cascade;
        alter table task_survey_files alter column survey_token set not null;
        alter table task_survey_files add foreign key (task_id, survey_token, submission_id)
          references task_survey_responses(task_id, survey_token, submission_id) on delete cascade;
        drop index task_survey_responses_recent_idx;
        drop index task_survey_one_respondent_idx;
        drop index task_survey_files_response_idx;
        create index task_survey_responses_recent_idx on task_survey_responses(survey_token, submitted_at desc, submission_id);
        create unique index task_survey_one_respondent_idx
          on task_survey_responses(survey_token, respondent_user_id) where respondent_user_id is not null;
        create index task_survey_files_response_idx on task_survey_files(survey_token, submission_id);
      end if;
    end
    $survey_migration$;
    alter table task_surveys enable row level security;
    alter table task_survey_responses enable row level security;
    alter table task_survey_files enable row level security;
  `).catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

type Progress = { revision: string; target: number; completed: number }
export const latestResearchProgressQuery = `
  select id::text as revision, target, completed
  from task_research_progress where task_id = $1 order by id desc limit 1
`

export async function getResearchProgress(taskId: string) {
  await ensureResearchProgressSchema()
  const { rows } = await getDb().query<Progress>(latestResearchProgressQuery, [taskId])
  return rows[0] ?? null
}

export async function listResearchProgressEvents(projectId: string) {
  await ensureResearchProgressSchema()
  const { rows } = await getDb().query<{
    task_id: string; title: string; target: number; completed: number; difference: number; recorded_at: string
  }>(`
    select e.task_id, b.title, e.target, e.completed, e.recorded_at,
      e.completed - lag(e.completed, 1, 0) over (partition by e.task_id order by e.id) as difference
    from task_research_progress e join backlog b on b.id=e.task_id
    where b.project_id=$1 and not b.is_deleted
    order by e.id
  `, [projectId])
  return rows
}

export async function saveResearchProgress(
  taskId: string,
  projectId: string,
  userId: string,
  input: { target: number; completed: number; revision: string | null },
) {
  await ensureResearchProgressSchema()
  const client = await getDb().connect()
  try {
    await client.query("begin")
    const task = await client.query(
      "select id from backlog where id=$1 and project_id=$2 and not is_archived and not is_deleted and status <> 'completed' for update",
      [taskId, projectId],
    )
    const survey = await client.query("select 1 from task_surveys where task_id=$1 and published_at is not null", [taskId])
    const { rows: [current] } = await client.query<Progress>(latestResearchProgressQuery, [taskId])
    if (!task.rowCount || (current?.revision ?? null) !== input.revision ||
        (!current && input.completed !== 0) || (survey.rowCount && input.completed !== current?.completed)) {
      await client.query("rollback")
      return null
    }
    if (current?.target === input.target && current.completed === input.completed) {
      await client.query("commit")
      return current
    }
    const { rows: [progress] } = await client.query<Progress>(`
      insert into task_research_progress (task_id, target, completed, recorded_by)
      values ($1,$2,$3,$4) returning id::text as revision, target, completed
    `, [taskId, input.target, input.completed, userId])
    await client.query("commit")
    return progress
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}
