export const LANDING_BANNER_MAX_BYTES = 2 * 1024 * 1024
export const LANDING_BANNER_MAX_IMAGES = 8
export const LANDING_BANNER_TYPES = "image/jpeg,image/png,image/webp"

export type LandingBannerSlide = {
  id: string
  alt: string
  revision: string
}

export function landingBannerImageUrl(slide: LandingBannerSlide) {
  return `/api/landing-banner?id=${encodeURIComponent(slide.id)}&v=${encodeURIComponent(slide.revision)}`
}
