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
function drag({ adviser = true, canChange = true, target = 'revision', parentCompleted = false } = {}) {
  const statuses = [], moves = []
  const task = { id: 'task', status: 'completed', parentId: parentCompleted ? 'parent' : null }
  const context = {
    canChangeTaskState: canChange, canEditAssignee: adviser, isSavingTaskStatus: false, isDragDisabled: false,
    todos: [task], isTaskCompletionLocked: () => true, hasCompletedTaskParent: () => parentCompleted,
    onStatusChange: (...args) => statuses.push(args), onMoveTodo: (...args) => moves.push(args),
  }
  const code = ts.transpileModule(`const handler = ${callback}; handler(result);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { ...context, result: { draggableId: 'task', source: { droppableId: 'completed', index: 0 }, destination: { droppableId: target, index: 0 } } })
  return { statuses, moves }
}
test('assigned adviser reopens Completed to Revision with status-only action', () => {
  const result = drag()
  assert.equal(result.statuses.length, 1)
  assert.equal(result.statuses[0][0], 'task')
  assert.equal(result.statuses[0][1], 'revision')
  assert.equal(result.moves.length, 0)
})
test('other users cannot reopen completed tasks', () => {
  assert.equal(drag({ adviser: false }).statuses.length, 0)
  assert.equal(drag({ canChange: false }).statuses.length, 0)
})
test('completed tasks cannot move to Todo, In Progress, or reorder in Completed', () => {
  for (const target of ['todo', 'inprogress', 'completed']) {
    const result = drag({ target })
    assert.equal(result.statuses.length, 0)
    assert.equal(result.moves.length, 0)
  }
})
test('completed ancestors keep subtasks locked', () => {
  assert.equal(drag({ parentCompleted: true }).statuses.length, 0)
})
