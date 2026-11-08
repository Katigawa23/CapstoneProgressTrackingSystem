import { getFacultyAccessState } from "@/lib/server-faculty-verification"
import { NextResponse } from "next/server"
import { readAuthenticatedUser } from "@/lib/server-auth"
import { getDb } from "@/lib/server-db"
import { listProjects } from "@/lib/server-project-repository"
import { getUserScopedProjectCookieKey, PROJECT_COOKIE_KEY } from "@/lib/projects"
import { getStudentAccessState } from "@/lib/server-student-profile"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const notificationId = url.searchParams.get("notificationId") ?? ""
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) return NextResponse.json({ error: "Invalid notification" }, { status: 400 })
  const user = await readAuthenticatedUser(true)
  if (!user) {
    const response = NextResponse.redirect(new URL("/", url.origin))
    response.cookies.set("pending_email_notification", notificationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    })
    return response
  }
  if (user.role === "faculty" && (await getFacultyAccessState(user.id)).status !== "approved") return NextResponse.redirect(new URL("/faculty-verification", url.origin))
  if (user.role === "student") {
    const access = await getStudentAccessState(user.id)
    if (access.required && access.status !== "approved") {
      return NextResponse.redirect(new URL(access.profileComplete ? "/student-verification" : "/student-profile", url.origin))
    }
  }
  const result = await getDb().query<{ project_id: string | null; backlog_item_id: string | null; type: string; href: string }>(
    "select project_id, backlog_item_id, type, href from notifications where id = $1 and recipient_user_id = $2",
    [notificationId, user.id]
  )
  const notification = result.rows[0]
  const projects = notification ? await listProjects(user.id) : []
  const coordinatorUpdate = notification?.type === "coordinator_assigned" || notification?.type === "coordinator_removed"
  if (!notification || (!coordinatorUpdate && !projects.some((project) => project.id === notification.project_id))) {
    return NextResponse.json({ error: "Notification or project is not available to this account." }, { status: 404 })
  }
  const isJournal = notification.type === "journal_submitted" || notification.type === "journal_adviser_feedback"
  const target = new URL(coordinatorUpdate ? "/dashboard" : isJournal ? "/dashboard/journal" : "/dashboard/board", url.origin)
  if (notification.project_id) target.searchParams.set("projectId", notification.project_id)
  if (notification.backlog_item_id) target.searchParams.set("taskId", notification.backlog_item_id)
  if (isJournal) {
    const week = new URL(notification.href, url.origin).searchParams.get("week")
    if (week && /^[1-9]\d*$/.test(week)) target.searchParams.set("week", week)
  }
  const response = NextResponse.redirect(target)
  if (notification.project_id) response.cookies.set(getUserScopedProjectCookieKey(PROJECT_COOKIE_KEY, user.id), notification.project_id, {
    httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000,
  })
  return response
}
