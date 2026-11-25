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

function drag({ student = false, canChange = true, source = 'completed', target = 'revision', parentCompleted = false } = {}) {
  const statuses = [], moves = [], rejected = []
  const task = { id: 'task', status: source, parentId: parentCompleted ? 'parent' : null }
  const context = {
    canChangeTaskState: canChange, isStudent: student, isSavingTaskStatus: false, isDragDisabled: false,
    todos: [task], isTaskCompletionLocked: () => source === 'completed' || parentCompleted,
    setDragSource: () => {},
    canTransitionTaskStatus: transitions.exports.canTransitionTaskStatus,
    onStatusChange: (id, target) => {
      const allowed = transitions.exports.canTransitionTaskStatus(source, target, student ? 'student' : 'faculty')
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
  assert.deepEqual(drag({ source: 'inprogress', target: 'todo' }).rejected, [['task', 'todo']])
  for (const target of ['revision', 'completed']) {
    assert.deepEqual(drag({ source: 'inprogress', target }).statuses, [['task', target]])
  }
})

test('adviser can only move Revision to Completed', () => {
  for (const target of ['todo', 'inprogress', 'revision']) {
    assert.deepEqual(drag({ source: 'revision', target }), {
      statuses: [], moves: [], rejected: target === 'revision' ? [] : [['task', target]],
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
