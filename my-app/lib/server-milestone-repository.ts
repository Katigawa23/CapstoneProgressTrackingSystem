import { getDb } from "@/lib/server-db"

export type MilestoneTaskAssignment = { taskId: string; chapter: number }

let schemaReady: Promise<void> | null = null

async function ensureMilestoneSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      create table if not exists milestone_task_chapters (
        task_id uuid primary key,
        project_id uuid not null,
        chapter smallint not null check (chapter between 1 and 5),
        updated_by text not null,
        updated_at timestamptz not null default now()
      );
      create index if not exists milestone_task_chapters_project_idx
        on milestone_task_chapters(project_id, chapter);
    `).then(() => undefined).catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

export async function listMilestoneTaskAssignments(projectId: string) {
  await ensureMilestoneSchema()
  const result = await getDb().query<{ task_id: string; chapter: number }>(
    `select task_id, chapter from milestone_task_chapters
     where project_id = $1 order by chapter, updated_at`,
    [projectId]
  )
  return result.rows.map((row) => ({ taskId: row.task_id, chapter: row.chapter }))
}

export async function assignTaskToMilestoneChapter(input: {
  projectId: string
  taskId: string
  chapter: number | null
  updatedBy: string
}) {
  await ensureMilestoneSchema()
  const task = await getDb().query<{ id: string }>(
    `select id from backlog where id = $1 and project_id = $2
       and parent_id is null and is_archived = false and is_deleted = false limit 1`,
    [input.taskId, input.projectId]
  )
  if (!task.rows[0]) return false

  if (input.chapter === null) {
    await getDb().query(
      `delete from milestone_task_chapters where task_id = $1 and project_id = $2`,
      [input.taskId, input.projectId]
    )
  } else {
    await getDb().query(
      `insert into milestone_task_chapters (task_id, project_id, chapter, updated_by)
       values ($1, $2, $3, $4)
       on conflict (task_id) do update set project_id = excluded.project_id,
         chapter = excluded.chapter, updated_by = excluded.updated_by, updated_at = now()`,
      [input.taskId, input.projectId, input.chapter, input.updatedBy]
    )
  }
  return true
}
