import { redirect } from "next/navigation"

import { readAuthenticatedUser } from "@/lib/server-auth"
import { SystemConfigurationPreview } from "./system-configuration-preview"

export default async function SystemConfigurationPage() {
  const user = await readAuthenticatedUser()

  if (user?.id !== "tester-admin") {
    redirect("/dashboard")
  }

  return <SystemConfigurationPreview />
}
