import { getPublicTaskSurvey } from "@/lib/server-task-survey"
import { isSurveyId } from "@/lib/task-survey"
import { PublicSurveyForm } from "./survey-form"
import { readAuthenticatedUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const survey = isSurveyId(token) ? await getPublicTaskSurvey(token) : null
  const user = survey?.settings?.requireSignIn || survey?.settings?.collectEmail
    ? await readAuthenticatedUser(true) : null

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:py-12">
      <p className="text-sm font-semibold text-muted-foreground">Trachsphere</p>
      {survey?.settings?.requireSignIn && !user ? (
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <h1 className="text-2xl font-semibold">{survey.title}</h1>
          <p className="text-sm">Sign in with your Trachsphere Microsoft account before answering this survey.</p>
          <a className="inline-flex rounded bg-primary px-4 py-2 text-sm text-primary-foreground" href={`/api/auth/microsoft?redirect=${encodeURIComponent(`/survey/${token}`)}`}>Sign in to answer</a>
        </div>
      ) : survey ? <PublicSurveyForm token={token} survey={survey} signedIn={Boolean(user)} /> : (
        <h1 className="text-xl font-semibold">This survey is unavailable or closed.</h1>
      )}
    </main>
  )
}
