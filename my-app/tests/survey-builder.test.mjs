import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/task-survey.ts', import.meta.url), 'utf8')
const sandbox = { exports: {}, URL, Map }
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox)
const { readSurveyDefinition, nextSurveySection, validateSurveyResponse, surveyCsv } = sandbox.exports

const tallySource = fs.readFileSync(new URL('../lib/survey-tallies.ts', import.meta.url), 'utf8')
const tallySandbox = { exports: {}, require: () => sandbox.exports }
vm.runInNewContext(ts.transpileModule(tallySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, tallySandbox)
const { buildSurveyTallies, combineSurveySelections, combineSurveyResults } = tallySandbox.exports

test('overall results combine every remaining question type with separate totals', () => {
  const questions = [
    { type: 'rating', max: 5 }, { type: 'rating', max: 10 }, { type: 'scale', max: 5 },
    { type: 'text' }, { type: 'text' }, { type: 'paragraph' }, { type: 'date' },
    { type: 'time' }, { type: 'time', duration: true }, { type: 'file', allowedTypes: ['text/plain'] },
  ]
  const values = ['3', '3', '4', 'Feedback', '12', 'Long feedback', '2026-11-20', '14:05', '0:05:00']
  const tallies = buildSurveyTallies(questions, 2, values.map((answer, question) => ({ question, answer, count: 2 })), [
    { question: 9, type: 'text/plain', count: 3, respondents: 2 },
  ])
  const byName = new Map(combineSurveyResults(questions, tallies).map((group) => [group.title, group]))
  assert.equal(byName.size, 9)
  assert.equal(byName.get('Rating').total, 4)
  assert.equal(byName.get('Rating').rows.find(({ label }) => label === '3 out of 10').count, 2)
  assert.equal(byName.get('Numeric short answer').rows[0].count, 2)
  assert.equal(byName.get('Paragraph').rows[0].label, 'Long feedback')
  assert.equal(byName.get('Time of day').rows[0].label, '14:00')
  assert.equal(byName.get('Duration').rows.find(({ count }) => count > 0).label, '5 to <15 min')
  assert.equal(byName.get('File upload').total, 3)
  assert.equal(byName.get('File upload').unit, 'files')
})

test('overall selections combine matching options across questions', () => {
  const questions = [{ type: 'choice' }, { type: 'checks' }, { type: 'rating' }]
  const { rows, total } = combineSurveySelections(questions, [
    { rows: [{ label: 'Banana', count: 2 }, { label: 'Avocado', count: 2 }, { label: 'Strawberry', count: 0 }] },
    { rows: [{ label: 'Banana', count: 1 }, { label: 'Mango', count: 1 }] },
    { rows: [{ label: '5', count: 4 }] },
  ])
  assert.equal(total, 6)
  assert.equal(rows.find(({ label }) => label === 'Banana').count, 3)
  assert.equal(rows.find(({ label }) => label === 'Banana').percent, 50)
  assert.equal(rows.find(({ label }) => label === 'Avocado').count, 2)
  assert.equal(rows.find(({ label }) => label === 'Mango').count, 1)
  assert.equal(rows.find(({ label }) => label === 'Strawberry').count, 0)
  assert.equal(rows.some(({ label }) => label === '5'), false)
})

test('overall written results include answers beyond one page of submissions', () => {
  const [paragraph, shortAnswer] = buildSurveyTallies([
    { label: 'Feedback', type: 'paragraph' },
    { label: 'Suggestion', type: 'text' },
  ], 25, [
    { question: 0, answer: 'Same answer', count: 23 },
    { question: 0, answer: 'Older answer', count: 1 },
    { question: 1, answer: 'Older suggestion', count: 1 },
  ], [])
  assert.equal(paragraph.answered, 24)
  assert.equal(paragraph.skipped, 1)
  assert.equal(paragraph.written[0].count, 23)
  assert.equal(paragraph.written[1].label, 'Older answer')
  assert.equal(shortAnswer.rows[0].label, 'Older suggestion')
  assert.equal(shortAnswer.skipped, 24)
})

test('branching skips validation and discards answers from unvisited sections', () => {
  const survey = readSurveyDefinition({
    title: 'Research questionnaire',
    sections: ['start', 'skipped', 'finish'].map((id) => ({ id, title: id, description: '' })),
    questions: [
      { section: 'start', label: 'Route', type: 'choice', options: ['Main route', 'Skip'], branches: { Skip: 'finish' } },
      { section: 'skipped', label: 'Required on normal route', type: 'file' },
      { section: 'finish', label: 'Final answer', type: 'text' },
    ],
  })
  assert.equal(nextSurveySection(survey, 'start', ['Skip']), 'finish')
  assert.ok(validateSurveyResponse(survey, ['Main route', null, null]).errors[1])
  const submitted = validateSurveyResponse(survey, ['Skip', 'Previous path answer', 'Done'])
  assert.equal(submitted.answers[1], null)
  assert.equal(submitted.answers[2], 'Done')
  assert.equal(Object.keys(submitted.errors).length, 0)
})

test('published surveys validate option settings and preserve legacy rating questions', () => {
  assert.equal(readSurveyDefinition({ title: 'Draft', questions: [{ label: '', type: 'dropdown' }] }), null)
  assert.ok(readSurveyDefinition({ title: '', questions: [{ label: '', type: 'dropdown' }] }, true))
  const legacy = readSurveyDefinition({ title: 'Original', purpose: 'Feedback', questions: [{ label: 'Rate us', type: 'rating' }] })
  assert.ok(legacy)
  assert.equal(validateSurveyResponse(legacy, ['5']).errors[0], undefined)
  assert.ok(validateSurveyResponse(legacy, ['6']).errors[0])
})

test('CSV quotes responses and neutralizes spreadsheet formulas', () => {
  const survey = readSurveyDefinition({ title: 'Export', questions: [{ label: 'Notes', type: 'paragraph' }] })
  const csv = surveyCsv(survey, [{ submittedAt: '2026-11-28T02:00:00Z', answers: ['=1+1\n"quoted"'] }])
  assert.match(csv, /"Submitted at","Notes"/)
  assert.match(csv, /"'=1\+1\n""quoted"""/)
})
