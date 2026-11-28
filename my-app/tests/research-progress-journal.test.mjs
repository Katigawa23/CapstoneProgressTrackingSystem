import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

test('task creation initializes a research count in the task insert only when a target is provided', async () => {
  const source = fs.readFileSync(new URL('../../backend/repositories/tasks-repository.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('tasks-repository.ts', source, ts.ScriptTarget.Latest, true)
  const create = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'createBacklogItem')
  assert.ok(create)
  const inserts = []
  let schemaChecks = 0
  const context = {
    exports: {},
    withBacklogStore: (databaseAction) => databaseAction(),
    ensureProjectExists: async () => true,
    ensureResearchProgressSchema: async () => { schemaChecks++ },
    getDb: () => ({
      query: async (sql, parameters) => {
        if (!sql.includes('insert into backlog')) return { rowCount: 0, rows: [] }
        inserts.push({ sql, parameters })
        return { rows: [{ id: 'task', parent_id: null }] }
      },
    }),
    mapRecord: (row) => ({ id: row.id, parentId: row.parent_id }),
    syncBacklogMirrorItems: async () => {},
    randomUUID: () => 'task',
    uppercaseFirstCharacter: (title) => title,
    normalizeItemNameForComparison: (title) => title.toLowerCase(),
  }
  vm.runInNewContext(ts.transpileModule(create.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  const task = { projectId: 'thesis', parentId: null, title: 'Interview participants', status: 'todo' }
  await context.exports.createBacklogItem(task, 'student')
  await context.exports.createBacklogItem({ ...task, researchTarget: 50 }, 'student')
  assert.equal(schemaChecks, 1)
  assert.doesNotMatch(inserts[0].sql, /insert into task_research_progress/)
  assert.match(inserts[1].sql, /insert into task_research_progress[\s\S]*select id, \$14, 0, \$4 from created/)
  assert.equal(inserts[1].parameters[13], 50)
})

test('research progress is grouped by week without counting ongoing work as a completed task', async () => {
  const source = fs.readFileSync(new URL('../lib/server-weekly-journal-repository.ts', import.meta.url), 'utf8')
  const simulateUpdate = (completed, difference, recorded_at) => ({
    task_id: 'interviews', title: 'Interview participants', target: 50, completed, difference, recorded_at,
  })
  const events = [
    simulateUpdate(10, 10, '2026-11-29T02:00:00Z'),
    simulateUpdate(18, 8, '2026-12-01T02:00:00Z'),
    simulateUpdate(32, 14, '2026-12-05T02:00:00Z'),
  ]
  const context = {
    exports: {},
    require(name) {
      if (name === '@/lib/server-research-progress') return { listResearchProgressEvents: async () => events }
      if (name === '@/lib/server-db') return {
        getDb: () => ({
          query: async (sql) => ({
            rows: sql.trimStart().startsWith('select created_at from projects') ? [{ created_at: '2026-11-28T02:00:00Z' }] : [],
          }),
        }),
      }
      throw new Error(`Unexpected import: ${name}`)
    },
  }
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  const summaries = await context.exports.listWeeklyJournalAutoSummaries('thesis')
  assert.match(summaries.find((week) => week.weekNumber === 1).workCompleted, /18 added this week · 18\/50 total/)
  assert.match(summaries.find((week) => week.weekNumber === 2).workCompleted, /14 added this week · 32\/50 total/)
  assert.ok(summaries.every((week) => week.tasksCompleted === 0))
})
