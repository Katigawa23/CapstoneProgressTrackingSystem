import { getDb } from "@/lib/server-db"
import type { LandingBannerSlide } from "@/lib/landing-banner"

let schemaReady: Promise<unknown> | undefined

export function ensureLandingBannerSchema() {
  schemaReady ??= getDb().query(`
    create table if not exists public.landing_banner_slides (
      id uuid primary key default gen_random_uuid(),
      alt text not null,
      mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
      image bytea not null,
      position integer not null,
      revision uuid not null default gen_random_uuid()
    );
    alter table public.landing_banner_slides enable row level security;
    revoke all on public.landing_banner_slides from anon, authenticated;
  `).catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

export async function listLandingBannerSlides() {
  await ensureLandingBannerSchema()
  const { rows } = await getDb().query<LandingBannerSlide>(
    "select id, alt, revision from public.landing_banner_slides order by position, id",
  )
  return rows
}
