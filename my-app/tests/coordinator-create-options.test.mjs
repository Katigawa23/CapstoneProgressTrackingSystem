import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadRoute(path, imports) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  const context = {
    exports: {},
    URL,
    Error,
    require(name) {
      if (name === 'next/server') return {
        NextResponse: { json: (body, init) => init?.status ? { ...body, status: init.status } : body },
      }
      if (!(name in imports)) throw new Error(`Missing import mock for ${name}`)
      return imports[name]
    },
  }
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context)
  return context.exports
}

test('unassigned coordinator tester gets no selectable programs', async () => {
  const options = [{ category: 'program', label: 'BSIT' }, { category: 'year_level', label: '4th Year' }]
  const { GET } = loadRoute('../app/api/project-configuration/route.ts', {
    '@/lib/server-auth': { requireAuthenticatedUser: async () => ({ id: 'tester-coordinator' }) },
    '@/lib/server-project-configuration': { listProjectConfigurationOptions: async () => options },
    '@/lib/server-coordinator-assignments': { listAssignedCoordinatorProgramLabels: async () => [] },
    '@/lib/projects': {},
  })
  const result = await GET()
  assert.deepEqual(result.options, [options[1]])
})

test('group creation reports expired sessions and invalid form data accurately', async () => {
  let authenticated = false
  const { POST } = loadRoute('../app/api/projects/route.ts', {
    'node:crypto': { randomUUID: () => 'test-request-id' },
    'next/cache': {},
    '@/lib/server-student-program-access': {},
    '@/lib/server-db': {},
    '@/lib/server-auth': { requireAuthenticatedUser: async () => {
      if (!authenticated) throw new Error('Unauthorized')
      return { id: 'coordinator', role: 'faculty' }
    } },
    '@/lib/projects': {},
    '@/lib/rbac': { isUserRole: () => true, canCreateProject: () => true },
    '@/lib/server-coordinator-assignments': { isAssignedCoordinator: async () => true },
    '@/lib/text-validation': {},
    '@/lib/server-project-email-events': {},
    '@/lib/project-workflow-presets': {},
    '@backend/repositories/projects-repository': {},
  })
  assert.equal((await POST({})).status, 401)
  authenticated = true
  assert.equal((await POST({ json: async () => { throw new SyntaxError('invalid JSON') } })).status, 400)
})

test('a failed group sync rolls back the project insert on the same database connection', async () => {
  const source = fs.readFileSync(new URL('../lib/server-project-repository.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('repository.ts', source, ts.ScriptTarget.Latest, true)
  const names = ['createProject', 'syncProjectGroupFromProject', 'insertProjectMemberAccessRecords']
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  assert.equal(functions.length, names.length)
  const calls = []
  const failure = Object.assign(new Error('test group sync failure'), { code: '23503' })
  const client = {
    async query(sql) {
      const statement = sql.trim().replace(/\s+/g, ' ')
      calls.push(statement)
      if (statement.startsWith('update groups')) throw failure
      return { rowCount: 0, rows: [] }
    },
    release() { calls.push('release') },
  }
  const context = {
    exports: {},
    console: { error() {} },
    getDb: () => ({ connect: async () => client }),
    withProjectStore: (databaseAction) => databaseAction(),
    normalizeProject: () => ({
      id: 'group-id', name: 'Test', members: [], advisers: [], program: 'BSIT',
      yearLevel: '4', syTerm: 'First term', projectType: 'Capstone',
    }),
    normalizeProjectNameForComparison: (name) => name.toLowerCase(),
    ProjectNameConflictError: class extends Error {},
    StudentAlreadyAssignedError: class extends Error {},
  }
  vm.runInNewContext(ts.transpileModule(functions.map((node) => node.getText(ast)).join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context)
  await assert.rejects(context.exports.createProject({ memberUserIds: [] }, 'coordinator'), (error) => error === failure)
  assert.equal(calls[0], 'begin')
  assert.ok(calls.some((statement) => statement.startsWith('insert into projects')))
  assert.deepEqual(calls.slice(-2), ['rollback', 'release'])
  assert.ok(!calls.includes('commit'))
})

test('group creation requires a research approach only for Thesis', async () => {
  const candidates = []
  const { POST } = loadRoute('../app/api/projects/route.ts', {
    'node:crypto': { randomUUID: () => 'test-request-id' },
    'next/cache': { revalidateTag() {} },
    '@/lib/server-student-program-access': { canAssignStudentsToProgram: async () => true },
    '@/lib/server-db': { getDb: () => ({ query: async () => ({ rows: [] }) }) },
    '@/lib/server-auth': { requireAuthenticatedUser: async () => ({ id: 'coordinator', role: 'faculty' }) },
    '@/lib/projects': {
      PROJECT_METADATA_MAX_LENGTH: 200,
      PROJECT_TITLE_MAX_LENGTH: 40,
      isResearchApproach: (value) => ['Quantitative', 'Qualitative', 'Mixed Methods'].includes(value),
      isThesisGroupType: (value) => /\bthesis\b/i.test(value),
    },
    '@/lib/rbac': { isUserRole: () => true, canCreateProject: () => true },
    '@/lib/server-coordinator-assignments': {
      isAssignedCoordinator: async () => true,
      listAssignedCoordinatorProgramLabels: async () => ['HM'],
    },
    '@/lib/text-validation': { hasInvalidTaskTitleCharacters: () => false, validateDisplayName: () => null },
    '@/lib/server-project-email-events': { notifyProjectEmailEvent: async () => {} },
    '@/lib/project-workflow-presets': { isProjectWorkflowPreset: () => true },
    '@backend/repositories/projects-repository': {
      createProject: async (input) => { candidates.push(input); return { id: 'group' } },
    },
  })
  const submit = (projectType, researchApproach) => POST({ json: async () => ({
    name: 'Study group', program: 'HM', yearLevel: '4', syTerm: 'First term', members: ['Student'],
    projectType, researchApproach,
  }) })
  assert.equal((await submit('Thesis')).status, 400)
  assert.equal((await submit('Thesis', 'Quantitative')).status, 201)
  assert.equal((await submit('Thesis', 'Mixed Methods')).status, 201)
  assert.equal((await submit('Capstone', 'Qualitative')).status, 201)
  assert.deepEqual(candidates.map((candidate) => candidate.researchApproach), ['Quantitative', 'Mixed Methods', undefined])
})

test('coordinator lookup passes the selected program and applies faculty filtering before pagination', async () => {
  const calls = []
  const user = { id: 'coordinator', role: 'faculty', tenantId: 'tenant', email: 'coordinator@example.test' }
  const { GET } = loadRoute('../app/api/registered-users/route.ts', {
    '@/lib/server-auth': { requireAuthenticatedUser: async () => user },
    '@/lib/server-coordinator-assignments': { isAssignedCoordinator: async () => true },
    '@/lib/server-student-program-access': { searchCoordinatorStudents: async (...args) => { calls.push(args); return [] } },
    '@backend/repositories/users-repository': {
      searchRegisteredMicrosoftUsers: async ({ role, query }) => { calls.push([role, query]); return [] },
    },
  })
  await GET({ url: 'http://localhost/api/registered-users?role=student&program=BSIT&q=Ana' })
  await GET({ url: 'http://localhost/api/registered-users?role=faculty&q=Reyes' })
  assert.deepEqual(calls, [['coordinator', 'tenant', 'Ana', 'BSIT'], ['faculty', 'Reyes']])
})
