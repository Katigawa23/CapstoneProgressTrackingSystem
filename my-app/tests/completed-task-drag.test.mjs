import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../app/(dashboard)/dashboard/components/dashboard-board/index.tsx', import.meta.url), 'utf8')
const ast = ts.createSourceFile('board.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let callback
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleDragEnd') callback = node.initializer.arguments[0].getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(callback)
const transitionSource = fs.readFileSync(new URL('../lib/task-status-transitions.ts', import.meta.url), 'utf8')
const transitions = { exports: {} }
vm.runInNewContext(ts.transpileModule(transitionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, transitions)

function drag({ student = false, canChange = true, source = 'completed', target = 'revision', parentCompleted = false, projectTransitions } = {}) {
  const statuses = [], moves = [], rejected = []
  const task = { id: 'task', status: source, parentId: parentCompleted ? 'parent' : null }
  const context = {
    canChangeTaskState: canChange, isStudent: student, isSavingTaskStatus: false, isDragDisabled: false,
    todos: [task], isTaskCompletionLocked: () => source === 'completed' || parentCompleted,
    setDragSource: () => {},
    projectTransitions,
    canTransitionTaskStatus: transitions.exports.canTransitionTaskStatus,
    onStatusChange: (id, target) => {
      const allowed = transitions.exports.canTransitionTaskStatus(source, target, student ? 'student' : 'faculty', projectTransitions)
      const results = allowed ? statuses : rejected
      results.push([id, target])
    },
    onMoveTodo: (...args) => moves.push(args),
  }
  const code = ts.transpileModule(`const handler = ${callback}; handler(result);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { ...context, result: { draggableId: 'task', source: { droppableId: source, index: 0 }, destination: { droppableId: target, index: 0 } } })
  return { statuses, moves, rejected }
}

test('completed tasks cannot leave or reorder in Completed', () => {
  for (const target of ['todo', 'inprogress', 'revision', 'completed']) {
    assert.deepEqual(drag({ target }), { statuses: [], moves: [], rejected: [] })
  }
})

test('adviser can advance In Progress to Revision or Completed', () => {
  assert.deepEqual(drag({ source: 'inprogress', target: 'todo' }).statuses, [])
  assert.deepEqual(drag({ source: 'inprogress', target: 'todo' }).rejected, [])
  for (const target of ['revision', 'completed']) {
    assert.deepEqual(drag({ source: 'inprogress', target }).statuses, [['task', target]])
  }
})

test('adviser can only move Revision to Completed', () => {
  for (const target of ['todo', 'inprogress', 'revision']) {
    assert.deepEqual(drag({ source: 'revision', target }), {
      statuses: [], moves: [], rejected: [],
    })
  }
  assert.deepEqual(drag({ source: 'revision', target: 'completed' }).statuses, [['task', 'completed']])
})

test('student can only move To-do to In Progress', () => {
  assert.deepEqual(drag({ student: true, source: 'todo', target: 'inprogress' }).statuses, [['task', 'inprogress']])
  for (const source of ['inprogress', 'revision', 'completed']) {
    for (const target of ['todo', 'inprogress', 'revision', 'completed']) {
      assert.deepEqual(drag({ student: true, source, target }), { statuses: [], moves: [], rejected: [] })
    }
  }
})

test('completed ancestors and read-only users cannot move tasks', () => {
  assert.deepEqual(drag({ source: 'revision', target: 'completed', parentCompleted: true }).statuses, [])
  assert.deepEqual(drag({ source: 'revision', target: 'completed', canChange: false }).statuses, [])
})

test('project transition settings are isolated and preserve legacy defaults', () => {
  const { canTransitionTaskStatus, legacyTaskTransitions, readProjectTaskTransitions } = transitions.exports
  const restricted = readProjectTaskTransitions([{ from: 'inprogress', to: 'revision', role: 'faculty' }])
  assert.ok(restricted)
  assert.equal(canTransitionTaskStatus('inprogress', 'completed', 'faculty', restricted), false)
  assert.equal(canTransitionTaskStatus('inprogress', 'revision', 'faculty', restricted), true)
  assert.equal(canTransitionTaskStatus('inprogress', 'completed', 'faculty', legacyTaskTransitions), true)
  assert.equal(canTransitionTaskStatus('todo', 'inprogress', 'student', []), false)
  assert.equal(readProjectTaskTransitions([{ from: 'completed', to: 'todo', role: 'faculty' }]), null)
  assert.equal(readProjectTaskTransitions([...restricted, ...restricted]), null)
  assert.deepEqual(drag({ source: 'inprogress', target: 'completed', projectTransitions: restricted }).statuses, [])
  assert.deepEqual(drag({ source: 'inprogress', target: 'revision', projectTransitions: restricted }).statuses, [['task', 'revision']])
})

test('project board columns preserve status IDs and validate labels and ordering', () => {
  const { defaultProjectBoardColumns, readProjectBoardColumns } = transitions.exports
  const columns = [...defaultProjectBoardColumns].reverse()
  columns[0] = { ...columns[0], label: '  Signed off  ' }
  const saved = readProjectBoardColumns(columns)
  assert.equal(saved[0].id, 'completed')
  assert.equal(saved[0].label, 'Signed off')
  assert.equal(defaultProjectBoardColumns[0].id, 'todo')
  assert.equal(defaultProjectBoardColumns[3].label, null)
  assert.equal(readProjectBoardColumns(columns.slice(1)), null)
  assert.equal(readProjectBoardColumns([columns[0], ...columns.slice(0, 3)]), null)
  assert.equal(readProjectBoardColumns([{ id: 'new-status', label: null }, ...columns.slice(1)]), null)
  assert.equal(readProjectBoardColumns([{ id: 'completed', label: 'x'.repeat(41) }, ...columns.slice(1)]), null)
  const limited = defaultProjectBoardColumns.map((column) => column.id === 'inprogress' ? { ...column, wipLimit: 2 } : column)
  assert.equal(readProjectBoardColumns(limited)[1].wipLimit, 2)
  assert.equal(readProjectBoardColumns(limited.map((column) => ({ ...column, wipLimit: 0 }))), null)
  assert.equal(readProjectBoardColumns([{ ...limited[0], wipLimit: 1 }, ...limited.slice(1)]), null)
})

test('custom states support adviser review loops and remain project-scoped', () => {
  const {
    canTransitionTaskStatus, defaultProjectBoardColumns, hasCustomStatusExitPaths,
    readProjectBoardColumns, readProjectTaskTransitions,
  } = transitions.exports
  const qa = 'custom-00000000-0000-4000-8000-000000000001'
  const changes = 'custom-00000000-0000-4000-8000-000000000002'
  const columns = readProjectBoardColumns([...defaultProjectBoardColumns, { id: qa, label: 'QA' }, { id: changes, label: 'Changes' }])
  assert.ok(columns)
  const entry = { from: 'inprogress', to: qa, role: 'faculty' }
  const loop = [{ from: qa, to: changes, role: 'faculty' }, { from: changes, to: qa, role: 'faculty' }]
  const exit = { from: changes, to: 'completed', role: 'faculty' }
  const rules = readProjectTaskTransitions([entry, ...loop, exit], columns)
  assert.ok(rules)
  assert.equal(canTransitionTaskStatus('inprogress', qa, 'faculty', rules), true)
  assert.equal(canTransitionTaskStatus('inprogress', qa, 'student', rules), false)
  assert.equal(readProjectTaskTransitions([entry]), null)
  assert.equal(readProjectTaskTransitions([{ ...entry, role: 'student' }], columns), null)
  assert.equal(readProjectTaskTransitions([{ ...entry, from: 'completed' }], columns), null)
  assert.equal(hasCustomStatusExitPaths(columns, [entry, ...loop]), false)
  assert.equal(hasCustomStatusExitPaths(columns, rules), true)
  assert.deepEqual(drag({ source: 'inprogress', target: qa, projectTransitions: rules }).statuses, [['task', qa]])
})

test('workflow presets produce independent configurations accepted by the shared engine', () => {
  const presetSource = fs.readFileSync(new URL('../lib/project-workflow-presets.ts', import.meta.url), 'utf8')
  const presets = { exports: {}, require: () => transitions.exports }
  vm.runInNewContext(ts.transpileModule(presetSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, presets)
  const { createWorkflowFromPreset, isProjectWorkflowPreset } = presets.exports
  const { readProjectBoardColumns, readProjectTaskTransitions, canTransitionTaskStatus } = transitions.exports
  for (const name of ['kanban', 'qa', 'academic']) {
    const workflow = createWorkflowFromPreset(name)
    assert.equal(workflow.requiresChapter, name === 'academic')
    const columns = readProjectBoardColumns(workflow.boardColumns)
    assert.ok(columns)
    assert.ok(readProjectTaskTransitions(workflow.transitions, columns))
    workflow.boardColumns[0].label = 'Local edit'
    assert.notEqual(createWorkflowFromPreset(name).boardColumns[0].label, 'Local edit')
  }
  assert.equal(isProjectWorkflowPreset('toString'), false)
  assert.equal(canTransitionTaskStatus('todo', 'completed', 'faculty', createWorkflowFromPreset('kanban').transitions), true)
  assert.equal(canTransitionTaskStatus('todo', 'completed', 'faculty', createWorkflowFromPreset('academic').transitions), false)

  const qa = 'custom-00000000-0000-4000-8000-000000000001'
  const customMove = { from: qa, to: 'inprogress', role: 'faculty' }
  const updated = createWorkflowFromPreset('academic', {
    boardColumns: [{ id: qa, label: 'QA' }, ...createWorkflowFromPreset('kanban').boardColumns.map((column) =>
      column.id === 'inprogress' ? { ...column, wipLimit: 2 } : column)],
    transitions: [customMove],
  })
  assert.equal(updated.boardColumns[0].id, qa)
  assert.equal(updated.boardColumns[0].label, 'QA')
  assert.equal(updated.boardColumns[1].label, 'Planned')
  assert.ok(updated.transitions.includes(customMove))
  assert.equal(updated.boardColumns.find((column) => column.id === 'inprogress').wipLimit, 2)
})
