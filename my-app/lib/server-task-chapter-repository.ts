import { getDb } from "@/lib/server-db"

let schemaReady: Promise<void> | null = null

async function ensureTaskChapterSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      create table if not exists task_chapters (
        task_id uuid primary key references backlog(id) on delete cascade,
        project_id uuid not null references projects(id) on delete cascade,
        chapter_number smallint not null check (chapter_number between 1 and 5),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists task_chapters_project_chapter_idx
        on task_chapters(project_id, chapter_number);
    `).then(() => undefined).catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

export async function saveTaskChapter(taskId: string, projectId: string, chapterNumber: number) {
  await ensureTaskChapterSchema()
  await getDb().query(
    `insert into task_chapters (task_id, project_id, chapter_number)
     values ($1, $2, $3)
     on conflict (task_id) do update set
       project_id = excluded.project_id,
       chapter_number = excluded.chapter_number,
       updated_at = now()`,
    [taskId, projectId, chapterNumber]
  )
}

export type CompletedChapterTask = {
  id: string
  title: string
  chapter: number
  assignee: string
  completedAt: string
  files: Array<{
    id: string
    name: string
    type: "document" | "pdf" | "image" | "archive"
    mimeType: string
    size: number
    uploadedBy: string
    uploadedAt: string
    downloadUrl: string
  }>
}

function classifyFile(fileName: string, mimeType: string): "document" | "pdf" | "image" | "archive" {
  const normalizedName = fileName.toLowerCase()
  const normalizedType = mimeType.toLowerCase()
  if (normalizedType === "application/pdf" || normalizedName.endsWith(".pdf")) return "pdf"
  if (normalizedType.startsWith("image/")) return "image"
  if (/\.(zip|rar|7z|tar|gz)$/.test(normalizedName)) return "archive"
  return "document"
}

export async function listCompletedChapterTasks(projectId: string): Promise<CompletedChapterTask[]> {
  await ensureTaskChapterSchema()
  const result = await getDb().query<{
    task_id: string
    title: string
    chapter_number: number
    assignee_name: string | null
    completed_at: string
    attachment_id: string | null
    file_name: string | null
    file_type: string | null
    file_size: number | string | null
    uploaded_at: string | null
    uploader_name: string | null
  }>(
    `select b.id as task_id, b.title, tc.chapter_number,
       assignee.name as assignee_name, b.updated_at as completed_at,
       a.id as attachment_id, a.file_name, a.file_type, a.file_size, a.uploaded_at,
       uploader.name as uploader_name
     from backlog b
     inner join task_chapters tc on tc.task_id = b.id and tc.project_id = b.project_id
     left join users assignee on assignee.microsoft_user_id = b.assignee_id
     left join attachments a on a.backlog_item_id = b.id
       and a.attachment_type = 'file' and a.is_archived = false and a.is_deleted = false
     left join users uploader on uploader.microsoft_user_id = a.uploaded_by_user_id
     where b.project_id = $1 and b.parent_id is null
       and b.status = 'completed' and b.is_archived = false and b.is_deleted = false
     order by tc.chapter_number, b.updated_at desc, a.uploaded_at desc`,
    [projectId]
  )

  const tasks = new Map<string, CompletedChapterTask>()
  for (const row of result.rows) {
    let task = tasks.get(row.task_id)
    if (!task) {
      task = {
        id: row.task_id,
        title: row.title,
        chapter: row.chapter_number,
        assignee: row.assignee_name ?? "Unassigned",
        completedAt: row.completed_at,
        files: [],
      }
      tasks.set(row.task_id, task)
    }
    if (row.attachment_id && row.file_name) {
      const mimeType = row.file_type ?? "application/octet-stream"
      task.files.push({
        id: row.attachment_id,
        name: row.file_name,
        type: classifyFile(row.file_name, mimeType),
        mimeType,
        size: Number(row.file_size ?? 0),
        uploadedBy: row.uploader_name ?? "Project member",
        uploadedAt: row.uploaded_at ?? row.completed_at,
        downloadUrl: `/api/backlog-items/${row.task_id}/submissions/file?submissionId=${encodeURIComponent(row.attachment_id)}&download=1`,
      })
    }
  }
  return Array.from(tasks.values())
}
