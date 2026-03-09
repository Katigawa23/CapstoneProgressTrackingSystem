const { randomUUID } = require("crypto");
const { mkdir, readFile, writeFile } = require("fs/promises");
const path = require("path");

const { env } = require("../config/env");
const { getDb } = require("../config/db");

const backlogFilePath = path.join(process.cwd(), ".data", "backlog-items.json");

let schemaReady = null;
let storageModePromise = null;
let fallbackWarningShown = false;

function mapRecord(record) {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    dueDate: record.due_date,
    status: record.status,
    checked: record.checked,
    assigneeId: record.assignee_id,
    file:
      record.file_name && record.file_size && record.file_type
        ? {
            name: record.file_name,
            size: record.file_size,
            type: record.file_type,
          }
        : null,
    createdAt: record.created_at,
  };
}

function toRecord(input) {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    due_date: input.dueDate,
    status: input.status,
    checked: input.checked,
    assignee_id: input.assigneeId,
    file_name: input.file ? input.file.name : null,
    file_size: input.file ? input.file.size : null,
    file_type: input.file ? input.file.type : null,
    created_at: input.createdAt,
  };
}

function canUseFileFallback() {
  return env.nodeEnv !== "production";
}

function shouldUseFileFallback(error) {
  if (!canUseFileFallback()) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  return [
    "DATABASE_URL is not set",
    "Unable to establish connection to upstream database",
    "Circuit breaker open",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "timeout expired",
    "server closed the connection unexpectedly",
  ].some((fragment) => message.includes(fragment));
}

function showFallbackWarning(error) {
  if (fallbackWarningShown) {
    return;
  }

  fallbackWarningShown = true;

  const message = error instanceof Error ? error.message : String(error);

  console.warn(
    `Backlog storage is falling back to local file data because PostgreSQL is unavailable: ${message}`
  );
}

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
          assignee_id text,
          file_name text,
          file_size text,
          file_type text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `)
      .then(() =>
        getDb().query(`
          alter table backlog_items
          add column if not exists assignee_id text;
        `)
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }

  await schemaReady;
}

async function getStorageMode() {
  if (!storageModePromise) {
    storageModePromise = (async () => {
      if (!env.databaseUrl) {
        if (!canUseFileFallback()) {
          throw new Error(
            "DATABASE_URL is not set. Add your database connection string to backend/.env."
          );
        }

        showFallbackWarning("DATABASE_URL is not set");
        return "file";
      }

      try {
        await ensureBacklogSchema();
        return "database";
      } catch (error) {
        if (!shouldUseFileFallback(error)) {
          throw error;
        }

        showFallbackWarning(error);
        return "file";
      }
    })();
  }

  return storageModePromise;
}

async function withBacklogStore(databaseAction, fileAction) {
  const storageMode = await getStorageMode();

  if (storageMode === "file") {
    return fileAction();
  }

  try {
    return await databaseAction();
  } catch (error) {
    if (!shouldUseFileFallback(error)) {
      throw error;
    }

    showFallbackWarning(error);
    storageModePromise = Promise.resolve("file");
    return fileAction();
  }
}

async function readFileRecords() {
  try {
    const raw = await readFile(backlogFilePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : null;

    if (code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeFileRecords(records) {
  await mkdir(path.dirname(backlogFilePath), { recursive: true });
  await writeFile(backlogFilePath, JSON.stringify(records, null, 2), "utf8");
}

async function listBacklogItems() {
  return withBacklogStore(
    async () => {
      const result = await getDb().query(
        `select
          id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type,
          created_at
        from backlog_items
        order by created_at desc`
      );

      return result.rows.map(mapRecord);
    },
    async () => {
      const records = await readFileRecords();
      return records.map(mapRecord);
    }
  );
}

async function createBacklogItem(input) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query(
        `insert into backlog_items (
          id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
          file_name,
          file_size,
          file_type
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning
          id,
          title,
          description,
          due_date,
          status,
          checked,
          assignee_id,
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
          input.assigneeId,
          input.file ? input.file.name : null,
          input.file ? input.file.size : null,
          input.file ? input.file.type : null,
        ]
      );

      return mapRecord(result.rows[0]);
    },
    async () => {
      const item = {
        id: randomUUID(),
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        status: input.status,
        checked: input.checked,
        assigneeId: input.assigneeId,
        file: input.file,
        createdAt: new Date().toISOString(),
      };

      const records = await readFileRecords();
      records.unshift(toRecord(item));
      await writeFileRecords(records);

      return item;
    }
  );
}

async function updateBacklogItem(id, input) {
  return withBacklogStore(
    async () => {
      const fields = [];
      const values = [];

      if (typeof input.title === "string") {
        fields.push(`title = $${fields.length + 1}`);
        values.push(input.title);
      }

      if (typeof input.description === "string") {
        fields.push(`description = $${fields.length + 1}`);
        values.push(input.description);
      }

      if (typeof input.status === "string") {
        fields.push(`status = $${fields.length + 1}`);
        values.push(input.status);
      }

      if (typeof input.checked === "boolean") {
        fields.push(`checked = $${fields.length + 1}`);
        values.push(input.checked);
      }

      if (Object.prototype.hasOwnProperty.call(input, "assigneeId")) {
        fields.push(`assignee_id = $${fields.length + 1}`);
        values.push(input.assigneeId == null ? null : input.assigneeId);
      }

      if (fields.length === 0) {
        return null;
      }

      fields.push("updated_at = now()");
      values.push(id);

      const result = await getDb().query(
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
          assignee_id,
          file_name,
          file_size,
          file_type,
          created_at`,
        values
      );

      return result.rows[0] ? mapRecord(result.rows[0]) : null;
    },
    async () => {
      const records = await readFileRecords();
      const index = records.findIndex((record) => record.id === id);

      if (index === -1) {
        return null;
      }

      if (Object.keys(input).length === 0) {
        return mapRecord(records[index]);
      }

      const current = mapRecord(records[index]);
      const next = {
        ...current,
        title: typeof input.title === "string" ? input.title : current.title,
        description:
          typeof input.description === "string"
            ? input.description
            : current.description,
        status: typeof input.status === "string" ? input.status : current.status,
        checked:
          typeof input.checked === "boolean" ? input.checked : current.checked,
        assigneeId: Object.prototype.hasOwnProperty.call(input, "assigneeId")
          ? input.assigneeId == null
            ? null
            : input.assigneeId
          : current.assigneeId,
      };

      records[index] = toRecord(next);
      await writeFileRecords(records);

      return next;
    }
  );
}

async function deleteBacklogItem(id) {
  return withBacklogStore(
    async () => {
      const result = await getDb().query(
        `delete from backlog_items
        where id = $1
        returning id`,
        [id]
      );

      return (result.rowCount || 0) > 0;
    },
    async () => {
      const records = await readFileRecords();
      const nextRecords = records.filter((record) => record.id !== id);

      if (nextRecords.length === records.length) {
        return false;
      }

      await writeFileRecords(nextRecords);
      return true;
    }
  );
}

module.exports = {
  listBacklogItems,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
};
