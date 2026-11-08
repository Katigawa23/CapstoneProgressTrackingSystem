import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
function setup(used, saveRows = 1, fail = false) {
  const calls = []
  let released = false
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args })
      if (sql.includes('for update')) return { rowCount: 1 }
      if (sql.includes('count(*)')) return { rows: [{ used, retryAt: '2099-01-01T00:00:00Z' }] }
      if (sql.includes('insert into public.student_profiles')) {
        if (fail) throw new Error('Save failed')
        return { rowCount: saveRows }
      }
      return {}
    }, release: () => { released = true },
  }
  const mocks = {
    '@/lib/server-db': { getDb: () => ({ query: async () => ({}), connect: async () => client }) },
    '@/lib/server-project-configuration': { listProjectConfigurationOptions: async () => [] },
  }
  const sandboxModule = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(fileURLToPath(new URL('../lib/server-student-profile.ts', import.meta.url)), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, Date, require: name => { if (!mocks[name]) throw Error(name); return mocks[name] } })
  const api = sandboxModule.exports
  return { api, calls, released: () => released, save: () => api.saveStudentProfile('student', { program: 'BSIT', yearLevel: '1st' }, 'program-id') }
}
test('fifth successful submission locks the account and commits', async () => {
  const s = setup(4)
  assert.equal(await s.save(), true)
  assert.equal(s.calls[0].sql, 'begin')
  assert.ok(s.calls[1].sql.includes('for update'))
  assert.equal(s.calls[1].args[0], 'student')
  assert.equal(s.calls.at(-1).sql, 'commit')
  assert.equal(s.released(), true)
})
test('sixth submission is blocked before writing and returns retry time', async () => {
  const s = setup(5)
  await assert.rejects(s.save(), error => error instanceof s.api.StudentSubmissionLimitError && Boolean(error.retryAt))
  assert.equal(s.calls.some(({ sql }) => sql.includes('insert into public.student_profiles')), false)
  assert.equal(s.calls.at(-1).sql, 'rollback')
  assert.equal(s.released(), true)
})
test('pending duplicate does not count as a successful submission', async () => {
  assert.equal(await setup(1, 0).save(), false)
})
test('failed save rolls back without consuming an attempt', async () => {
  const s = setup(1, 1, true)
  await assert.rejects(s.save())
  assert.equal(s.calls.at(-1).sql, 'rollback')
  assert.equal(s.released(), true)
})
