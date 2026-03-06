import { randomUUID } from "crypto"

import { getDb } from "@/lib/db"

export type BacklogRow = {
  id: string
  title: string
  description: string
  dueDate: string | null
  status: string
  checked: boolean
  file: {
    name: string
    size: string
    type: string
  } | null
  createdAt: string
}

type CreateBacklogItemInput = {
  title: string
  description: string
  dueDate: string | null
  status: string
  checked: boolean
  file: {
    name: string
    size: string
    type: string
  } | null
}

type BacklogRecord = {
  id: string
  title: string
  description: string
  due_date: string | null
  status: string
  checked: boolean
  file_name: string | null
  file_size: string | null
  file_type: string | null
  created_at: string
}

function mapRecord(record: BacklogRecord): BacklogRow {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    dueDate: record.due_date,
    status: record.status,
    checked: record.checked,
    file:
      record.file_name && record.file_size && record.file_type
        ? {
            name: record.file_name,
            size: record.file_size,
            type: record.file_type,
          }
        : null,
    createdAt: record.created_at,
  }
}

let schemaReady: Promise<void> | null = null

async function ensureBacklogSchema() {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        create table if not exists backlog_items (
          id uuid primary key,
          title text not null,
          description text not null default '',
          due_date date,
          status text not null check (
            status in ('todo', 'inprogress', 'inreview', 'revision', 'completed')
          ),
          checked boolean not null default false,
          file_name text,
          file_size text,
          file_type text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null
        throw error
      })
  }

  await schemaReady
}

export async function listBacklogItems() {
  await ensureBacklogSchema()

  const result = await getDb().query<BacklogRecord>(
    `select
      id,
      title,
      description,
      due_date,
      status,
      checked,
      file_name,
      file_size,
      file_type,
      created_at
    from backlog_items
    order by created_at desc`
  )

  return result.rows.map(mapRecord)
}

export async function createBacklogItem(input: CreateBacklogItemInput) {
  await ensureBacklogSchema()

  const result = await getDb().query<BacklogRecord>(
    `insert into backlog_items (
      id,
      title,
      description,
      due_date,
      status,
      checked,
      file_name,
      file_size,
      file_type
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning
      id,
      title,
      description,
      due_date,
      status,
      checked,
      file_name,
      file_size,
      file_type,
      created_at`,
    [
      randomUUID(),
      input.title,
      input.description,
      input.dueDate,
      input.status,
      input.checked,
      input.file?.name ?? null,
      input.file?.size ?? null,
      input.file?.type ?? null,
    ]
  )

  return mapRecord(result.rows[0])
}

export async function updateBacklogItem(
  id: string,
  input: { status?: string; checked?: boolean }
) {
  await ensureBacklogSchema()

  const fields: string[] = []
  const values: Array<string | boolean> = []

  if (typeof input.status === "string") {
    fields.push(`status = $${fields.length + 1}`)
    values.push(input.status)
  }

  if (typeof input.checked === "boolean") {
    fields.push(`checked = $${fields.length + 1}`)
    values.push(input.checked)
  }

  if (fields.length === 0) {
    return null
  }

  fields.push(`updated_at = now()`)
  values.push(id)

  const result = await getDb().query<BacklogRecord>(
    `update backlog_items
    set ${fields.join(", ")}
    where id = $${values.length}
    returning
      id,
      title,
      description,
      due_date,
      status,
      checked,
      file_name,
      file_size,
      file_type,
      created_at`,
    values
  )

  return result.rows[0] ? mapRecord(result.rows[0]) : null
}
