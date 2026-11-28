import { getPreferredStorageMode } from "@backend/config/storage-mode"
import { ensureBacklogSchema } from "@backend/repositories/tasks-repository"
import { getDb } from "@/lib/server-db"
import { ensureProjectsSchema } from "@/lib/server-project-repository"
import {
  legacyTaskTransitions,
  isCustomTaskStatus,
  defaultProjectBoardColumns,
  readProjectBoardColumns,
  readProjectTaskTransitions,
  type ProjectBoardColumn,
  type TaskTransition,
} from "@/lib/task-status-transitions"

let customStatusSchemaReady: Promise<void> | undefined

function ensureCustomStatusSchema() {
  customStatusSchemaReady ??= (async () => {
    await ensureBacklogSchema()
    await getDb().query(`
      do $$
      declare task_table text; constraint_name text;
      begin
        perform pg_advisory_xact_lock(hashtext('tracksphere-custom-task-status-checks'));
        foreach task_table in array array['backlog', 'tasks', 'subtasks'] loop
          constraint_name := task_table || '_workflow_status_check';
          if not exists (
            select 1 from pg_constraint
            where conrelid = task_table::regclass and conname = constraint_name
          ) then
            execute format(
              'alter table %I add constraint %I check (
                status in (''todo'', ''inprogress'', ''inreview'', ''revision'', ''completed'')
                or status ~ ''^custom-[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
              ) not valid',
              task_table, constraint_name
            );
            execute format('alter table %I drop constraint if exists %I', task_table, task_table || '_status_check');
          end if;
        end loop;
      end $$;
    `)
  })().catch((error) => {
    customStatusSchemaReady = undefined
    throw error
  })
  return customStatusSchemaReady
}

export function canPersistProjectWorkflow() {
  return getPreferredStorageMode() === "database"
}

export async function getProjectWorkflow(projectId: string) {
  if (!canPersistProjectWorkflow()) {
    return { revision: 0, transitions: legacyTaskTransitions, boardColumns: defaultProjectBoardColumns, requiresChapter: true }
  }

  await ensureProjectsSchema()
  const { rows: [project] } = await getDb().query<{
    workflow_transitions: unknown
    workflow_board_columns: unknown
    workflow_requires_chapter: boolean
    workflow_revision: number
  }>("select workflow_transitions, workflow_board_columns, workflow_requires_chapter, workflow_revision from projects where id::text = $1", [projectId])

  const boardColumns = project?.workflow_board_columns == null
    ? defaultProjectBoardColumns : readProjectBoardColumns(project.workflow_board_columns)
  if (!boardColumns) throw new Error("Invalid stored project board columns")
  const transitions = project?.workflow_transitions == null
    ? legacyTaskTransitions : readProjectTaskTransitions(project.workflow_transitions, boardColumns)
  if (!transitions) throw new Error("Invalid stored project workflow")
  return { revision: project?.workflow_revision ?? 0, transitions, boardColumns, requiresChapter: project?.workflow_requires_chapter ?? true }
}

export async function saveProjectWorkflow(
  projectId: string,
  ownerUserId: string,
  revision: number,
  transitions: TaskTransition[],
  boardColumns?: ProjectBoardColumn[],
  requiresChapter?: boolean
) {
  await ensureProjectsSchema()
  if (boardColumns?.some((column) => isCustomTaskStatus(column.id))) await ensureCustomStatusSchema()
  const { rows: [project] } = await getDb().query<{
    workflow_revision: number; workflow_board_columns: unknown; workflow_requires_chapter: boolean
  }>(
    `update projects
     set workflow_transitions = $4::jsonb,
         workflow_board_columns = coalesce($5::jsonb, workflow_board_columns),
         workflow_requires_chapter = coalesce($6::boolean, workflow_requires_chapter),
         workflow_revision = workflow_revision + 1
     where id::text = $1 and owner_user_id = $2 and workflow_revision = $3 and not is_archived
       and ($5::jsonb is null or not exists (
         select 1 from jsonb_array_elements(workflow_board_columns) as existing(column_value)
         where not ($5::jsonb @> jsonb_build_array(jsonb_build_object('id', column_value->>'id')))
       ))
     returning workflow_revision, workflow_board_columns, workflow_requires_chapter`,
    [projectId, ownerUserId, revision, JSON.stringify(transitions), boardColumns ? JSON.stringify(boardColumns) : null, requiresChapter ?? null]
  )
  return project ? {
    revision: project.workflow_revision,
    transitions,
    boardColumns: readProjectBoardColumns(project.workflow_board_columns) ?? defaultProjectBoardColumns,
    requiresChapter: project.workflow_requires_chapter,
  } : null
}
