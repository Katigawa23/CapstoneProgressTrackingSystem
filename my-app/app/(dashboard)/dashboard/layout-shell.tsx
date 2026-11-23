import type { AuthSession } from "@/lib/auth-client"
import type { DashboardProject } from "@/lib/projects"
import { DashboardLayoutClient } from "./layout-client"
import { AvatarPhotosProvider } from "@/components/ui/avatar"
import { getMicrosoftProfilePhotos } from "@backend/repositories/users-repository"

export async function DashboardLayoutShell({
  children,
  initialAuthSession,
  profilePhoto,
  initialProjects,
  initialTeam,
  coordinatorMode = false,
}: {
  children: React.ReactNode
  initialAuthSession: AuthSession | null
  profilePhoto?: string | null
  initialProjects: DashboardProject[]
  initialTeam: DashboardProject | null
  coordinatorMode?: boolean
}) {
  const userIds = initialProjects.flatMap((project) => [
    ...project.memberUserIds,
    ...(project.ownerUserId ? [project.ownerUserId] : []),
  ])
  const photos = initialAuthSession
    ? await getMicrosoftProfilePhotos([...new Set(userIds)])
    : new Map<string, string | null>()
  if (initialAuthSession && profilePhoto) photos.set(initialAuthSession.user.id, profilePhoto)

  return (
    <AvatarPhotosProvider photos={Object.fromEntries(photos)}>
    <DashboardLayoutClient
      initialAuthSession={initialAuthSession}
      profilePhoto={profilePhoto}
      initialProjects={initialProjects}
      initialTeam={initialTeam}
      coordinatorMode={coordinatorMode}
    >
      {children}
    </DashboardLayoutClient>
    </AvatarPhotosProvider>
  )
}
