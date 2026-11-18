import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function setup(user, saved, access) {
  let identity
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } },
    '@/lib/server-auth': { readAuthenticatedUser: async () => user },
    '@/lib/server-faculty-verification': {
      resubmitFacultyVerification: async (...args) => { identity = args; return saved },
      getFacultyAccessState: async () => access,
    },
  }
  const sandboxModule = { exports: {} }
  const source = fs.readFileSync(new URL('../app/api/faculty-verification/resubmit/route.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, Date, Math, String, require: key => { if (!mocks[key]) throw Error(key); return mocks[key] } })
  return { post: sandboxModule.exports.POST, identity: () => identity }
}
test('unsigned and student accounts cannot submit faculty requests', async () => {
  assert.equal((await setup(null).post()).status, 401)
  assert.equal((await setup({ id: 'student', role: 'student' }).post()).status, 403)
})
test('resubmission uses signed-in faculty identity and tenant only', async () => {
  const api = setup({ id: 'faculty', role: 'faculty', tenantId: 'school' }, true, { status: 'pending' })
  assert.equal((await api.post()).status, 200)
  assert.equal(api.identity()[0], 'faculty')
  assert.equal(api.identity()[1], 'school')
})
test('rejected faculty at quota receives retry time and HTTP 429', async () => {
  const api = setup({ id: 'faculty', role: 'faculty', tenantId: 'school' }, false, { status: 'rejected', retryAt: '2099-01-01T00:00:00Z' })
  const result = await api.post()
  assert.equal(result.status, 429)
  assert.equal(result.body.retryAt, '2099-01-01T00:00:00Z')
  assert.ok(Number(result.headers['Retry-After']) > 0)
})
test('pending or approved requests cannot be submitted again', async () => {
  for (const status of ['pending', 'approved']) {
    const api = setup({ id: 'faculty', role: 'faculty', tenantId: 'school' }, false, { status, retryAt: null })
    assert.equal((await api.post()).status, 409)
  }
})
