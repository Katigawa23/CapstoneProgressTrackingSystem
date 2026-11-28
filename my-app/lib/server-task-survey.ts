import { readAuthenticatedUser } from "@/lib/server-auth"
import { buildSurveyTallies, surveyTallyCsvRows, type AnswerFrequency, type FileFrequency } from "@/lib/survey-tallies"
import { getDb } from "@/lib/server-db"
import { ensureResearchProgressSchema, latestResearchProgressQuery } from "@/lib/server-research-progress"
import {
  defaultSurveySettings, isSurveyEmail, isSurveyId, readSurveyDefinition, surveyCsv, encodeSurveyCsvRows, validateSurveyResponse,
  type SurveyAnswer, type SurveyDefinition,
} from "@/lib/task-survey"

type SurveyRow = Pick<SurveyDefinition, "title" | "purpose" | "questions"> & {
  configuration: Pick<SurveyDefinition, "settings" | "sections">
  token: string; published: boolean; closed: boolean
}
type SurveyResponse = { id: string; answers: SurveyAnswer[]; submittedAt: string; email: string | null }
const fields = "s.token, s.title, s.purpose, s.questions, s.configuration, (s.published_at is not null) as published, (s.closed_at is not null) as closed"
const responseFields = 'submission_id as id, answers, submitted_at as "submittedAt", email'

function definition(row: SurveyRow, draft = false) {
  return readSurveyDefinition({ title: row.title, purpose: row.purpose, questions: row.questions, ...row.configuration }, draft)
}

export async function getTaskSurveyAccess(id: string, authenticatedUser?: Awaited<ReturnType<typeof readAuthenticatedUser>>, requireProgress = true) {
  const user = authenticatedUser ?? await readAuthenticatedUser()
  if (!user || !isSurveyId(id) || (user.role !== "student" && user.role !== "faculty")) return null
  await ensureResearchProgressSchema()
  const { rows: [access] } = await getDb().query<{
    allowed: boolean; projectId: string; taskTitle: string; published: boolean; hasSurvey: boolean
    surveyTitle: string | null; surveyClosed: boolean; surveyToken: string | null
  }>(`
    select p.id as "projectId", b.title as "taskTitle", s.published_at is not null as published,
      s.token as "surveyToken", s.task_id is not null as "hasSurvey", s.title as "surveyTitle", s.closed_at is not null as "surveyClosed",
      case when $3 = 'student' then (
      $2 = any(p.member_user_ids) or exists (select 1 from groups g where g.project_id=p.id and $2=any(g.member_user_ids))
    ) else exists (
      select 1 from groups g where g.project_id=p.id and (
        g.adviser_user_id=$2 or (g.adviser_user_id is null and $2=any(g.member_user_ids) and $4=any(p.project_adviser))
      )
    ) end as allowed
    from backlog b join projects p on p.id=b.project_id
    left join lateral (select * from task_surveys where task_id=b.id order by created_at, token limit 1) s on true
    where (not $5::boolean or exists (select 1 from task_research_progress r where r.task_id=b.id))
      and b.id=$1 and not p.is_archived and not b.is_archived and not b.is_deleted and p.research_approach is not null
  `, [id, user.id, user.role, user.name, requireProgress])
  if (!access?.allowed) return null
  return { ...access, user }
}

export async function listTaskSurveys(taskId: string) {
  const { rows } = await getDb().query<{ token: string; title: string; published: boolean; closed: boolean }>(
    `select token,title,published_at is not null as published, closed_at is not null as closed
     from task_surveys where task_id=$1 order by created_at, token`, [taskId]
  )
  return rows
}

export async function countTaskSurveyResponses(taskId: string, token: string) {
  const { rows: [row] } = await getDb().query<{ count: number }>(
    "select count(*)::int as count from task_survey_responses where task_id=$1 and survey_token=$2", [taskId, token]
  )
  return row.count
}

async function getSurveyTallies(taskId: string, token: string, survey: SurveyDefinition, cutoff?: string) {
  const { rows: [stats] } = await getDb().query<{ responseCount: number; answers: AnswerFrequency[]; files: FileFrequency[] }>(`
    with responses as (
      select submission_id, answers from task_survey_responses
      where task_id=$1 and survey_token=$2 and ($3::timestamptz is null or submitted_at <= $3)
    ), frequencies as (
      select (entry.pos-1)::int as question, entry.answer, count(*)::int as count
      from responses cross join lateral jsonb_array_elements(answers) with ordinality entry(answer,pos)
      where entry.answer <> 'null'::jsonb
      group by entry.pos,entry.answer
    ), uploads as (
      select f.question_index as question, f.content_type as type, f.submission_id
      from task_survey_files f join responses r using (submission_id) where f.task_id=$1 and f.survey_token=$2
    ), upload_counts as (
      select question,type,count(*)::int as count from uploads group by question,type
    ), upload_respondents as (
      select question,count(distinct submission_id)::int as respondents from uploads group by question
    )
    select (select count(*)::int from responses) as "responseCount",
      coalesce((select jsonb_agg(frequencies) from frequencies), '[]'::jsonb) as answers,
      coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('respondents', r.respondents))
        from upload_counts c join upload_respondents r using (question)), '[]'::jsonb) as files
  `, [taskId, token, cutoff ?? null])
  return { responseCount: stats.responseCount, summary: buildSurveyTallies(survey.questions, stats.responseCount, stats.answers, stats.files) }
}

export async function getTaskSurvey(taskId: string, token: string | null, offset: number) {
  await ensureResearchProgressSchema()
  const { rows: [row] } = await getDb().query<SurveyRow>(`select ${fields} from task_surveys s where task_id=$1 and token=$2`, [taskId, token])
  const survey = row && definition(row, !row.published)
  if (!survey) return { survey: null, responses: [], responseCount: 0, summary: [] }
  const [responses, stats] = await Promise.all([
    getDb().query<SurveyResponse>(
      `select ${responseFields} from task_survey_responses where task_id=$1 and survey_token=$2 order by submitted_at desc, submission_id limit 20 offset $3`, [taskId, row.token, offset]
    ),
    getSurveyTallies(taskId, row.token, survey),
  ])
  const files = await getDb().query<{ id: string; responseId: string; questionIndex: number; name: string }>(`
    select id, submission_id as "responseId", question_index as "questionIndex", name
    from task_survey_files where task_id=$1 and survey_token=$2 and submission_id=any($3::uuid[]) order by question_index,id
  `, [taskId, row.token, responses.rows.map(({ id }) => id)])
  return {
    survey: { ...survey, token: row.token, published: row.published, closed: row.closed },
    responses: responses.rows.map((response) => ({ ...response, files: files.rows.filter(({ responseId }) => responseId === response.id) })),
    ...stats,
  }
}

export async function saveTaskSurvey(taskId: string, token: string, userId: string, survey: SurveyDefinition, publish: boolean) {
  const { rowCount } = await getDb().query(`
    with open_task as (
      select id from backlog where id=$1 and not is_archived and not is_deleted and status <> 'completed' for update
    )
    insert into task_surveys (task_id,title,purpose,questions,published_by,published_at,configuration,token)
    select b.id,$2,$3,$4::jsonb,case when $6 then $5::text end,case when $6 then now() end,$7::jsonb,$8
    from open_task b
    on conflict (token) do update set title=excluded.title,purpose=excluded.purpose,questions=excluded.questions,
      published_by=excluded.published_by,published_at=excluded.published_at,configuration=excluded.configuration
    where task_surveys.task_id=excluded.task_id and task_surveys.published_at is null
  `, [taskId, survey.title, survey.purpose, JSON.stringify(survey.questions), userId, publish,
    JSON.stringify({ sections: survey.sections, settings: survey.settings }), token])
  return Boolean(rowCount)
}

export async function setTaskSurveyClosed(taskId: string, token: string | null, closed: boolean) {
  const {rowCount} = await getDb().query(`
    update task_surveys set closed_at=case when $2 then coalesce(closed_at,now()) end
    where task_id=$1 and token=$3 and published_at is not null
  `, [taskId, closed, token])
  return Boolean(rowCount)
}

export async function getPublicTaskSurvey(token: string) {
  await ensureResearchProgressSchema()
  const { rows: [row] } = await getDb().query<SurveyRow>(`
    select ${fields} from task_surveys s join backlog b on b.id=s.task_id
    join projects p on p.id=b.project_id
    join lateral (select target,completed from task_research_progress where task_id=b.id order by id desc limit 1) progress on true
    where s.token=$1 and s.published_at is not null and s.closed_at is null and not p.is_archived
      and not b.is_archived and not b.is_deleted and b.status <> 'completed' and (select count(*) from task_survey_responses where survey_token=s.token) < progress.target
  `, [token])
  return row ? definition(row) : null
}

function safeFileContent(type: string, bytes: Buffer) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-"
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (type === "text/plain" || type === "text/csv") {
    try { return !/[\u0000-\u0008]/.test(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) } catch { return false }
  }
  return false
}

export async function submitPublicSurvey(token: string, submissionId: string, input: unknown, files: Map<number, File[]>,
  respondent?: { id: string; email: string } | null, inputEmail?: unknown) {
  await ensureResearchProgressSchema()
  const client = await getDb().connect()
  let committed = false
  try {
    await client.query("begin")
    const { rows: [row] } = await client.query<SurveyRow & { task_id: string; published_by: string; accepting: boolean }>(`
      select ${fields},s.task_id,s.published_by,
        (s.closed_at is null and not p.is_archived and not b.is_archived and not b.is_deleted and b.status <> 'completed') as accepting
      from task_surveys s join backlog b on b.id=s.task_id join projects p on p.id=b.project_id
      where s.token=$1 and s.published_at is not null for update of b,s
    `, [token])
    const survey = row && definition(row)
    if (!survey) return { status: "closed" as const }
    const settings = survey.settings ?? defaultSurveySettings
    if (settings.requireSignIn && !respondent) return { status: "signIn" as const }
    const account = settings.limitOne ? respondent?.id ?? null : null
    const {rows:[duplicate]} = await client.query<{ respondent_user_id: string | null }>(
      "select respondent_user_id from task_survey_responses where survey_token=$1 and submission_id=$2", [token, submissionId]
    )
    if (duplicate && duplicate.respondent_user_id === account) return { status: "saved" as const, confirmation: settings.confirmation }
    if (duplicate) return { status: "duplicate" as const }
    if (account && (await client.query("select 1 from task_survey_responses where survey_token=$1 and respondent_user_id=$2", [token, account])).rowCount) {
      return { status: "duplicate" as const }
    }
    const { rows: [count] } = await client.query<{ target: number; completed: number }>(latestResearchProgressQuery, [row.task_id])
    const { rows: [received] } = await client.query<{ count: number }>(
      "select count(*)::int as count from task_survey_responses where survey_token=$1", [token]
    )
    if (!row.accepting || !count || received.count >= count.target) return { status: "closed" as const }
    const providedEmail = typeof inputEmail === "string" ? inputEmail.trim() : ""
    const email = settings.collectEmail ? respondent?.email ?? providedEmail : null
    const validated = validateSurveyResponse(survey, input, files)
    if (!validated || Object.keys(validated.errors).length || (settings.collectEmail && !isSurveyEmail(email))) {
      return { status: "invalid" as const, errors: validated?.errors, emailError: settings.collectEmail && !isSurveyEmail(email) }
    }
    const attachments: { index: number; name: string; type: string; bytes: Buffer }[] = []
    for (const [index, entries] of files) {
      if (!validated.visited.has(index) || survey.questions[index]?.type !== "file") continue
      for (const file of entries) {
        const bytes = Buffer.from(await file.arrayBuffer())
        if (!safeFileContent(file.type, bytes)) return { status: "invalid" as const, errors: { [index]: "The file contents do not match the selected file type." } }
        const name = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 180) || "attachment"
        attachments.push({ index, name, type: file.type, bytes })
      }
      validated.answers[index] = entries.map((_, position) => attachments[attachments.length - entries.length + position].name)
    }
    await client.query(
      "insert into task_survey_responses (task_id,submission_id,answers,email,respondent_user_id,survey_token) values ($1,$2,$3::jsonb,$4,$5,$6)",
      [row.task_id, submissionId, JSON.stringify(validated.answers), email, account, token],
    )
    for (const file of attachments) {
      await client.query(
        "insert into task_survey_files (task_id,submission_id,question_index,name,content_type,content,survey_token) values ($1,$2,$3,$4,$5,$6,$7)",
        [row.task_id, submissionId, file.index, file.name, file.type, file.bytes, token],
      )
    }
    if (count.completed < count.target) await client.query(
      "insert into task_research_progress (task_id,target,completed,recorded_by) values ($1,$2,$3,$4)",
      [row.task_id, count.target, count.completed + 1, row.published_by],
    )
    await client.query("commit")
    committed = true
    return { status: "saved" as const, confirmation: settings.confirmation }
  } finally {
    try { if (!committed) await client.query("rollback") } finally { client.release() }
  }
}

export async function getTaskSurveyFile(taskId: string, token: string, fileId: string) {
  const {rows:[file]} = await getDb().query<{ name: string; content: Buffer }>(
    "select name,content from task_survey_files where task_id=$1 and survey_token=$2 and id=$3", [taskId, token, fileId]
  )
  return file ?? null
}

export async function exportTaskSurvey(taskId: string, token: string) {
  const { rows: [row] } = await getDb().query<SurveyRow>(`select ${fields} from task_surveys s where task_id=$1 and token=$2`, [taskId, token])
  const survey = row && definition(row, !row.published)
  if (!survey) return null
  const encoder = new TextEncoder()
  const cutoff = new Date().toISOString()
  const { summary } = await getSurveyTallies(taskId, row.token, survey, cutoff)
  const tallies = encodeSurveyCsvRows(surveyTallyCsvRows(summary))
  let offset = 0
  return new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode(surveyCsv(survey, []) + "\r\n")) },
    async pull(controller) {
      const {rows} = await getDb().query<SurveyResponse>(`
        select ${responseFields} from task_survey_responses
        where task_id=$1 and survey_token=$2 and submitted_at <= $4 order by submitted_at, submission_id limit 250 offset $3
      `, [taskId, row.token, offset, cutoff])
      if (rows.length) {
        controller.enqueue(encoder.encode(surveyCsv(survey, rows, false) + "\r\n"))
      }
      offset += rows.length
      if (rows.length < 250) {
        controller.enqueue(encoder.encode("\r\n" + tallies + "\r\n"))
        controller.close()
      }
    },
  })
}
