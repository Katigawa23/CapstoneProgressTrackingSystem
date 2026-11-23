import { LandingPageClient } from "./landing-page-client"
import { listLandingBannerSlides } from "@/lib/server-landing-banner"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const slides = await listLandingBannerSlides().catch((error) => {
    console.error("Could not load landing banner", error)
    return []
  })

  return <LandingPageClient slides={slides} />
}
