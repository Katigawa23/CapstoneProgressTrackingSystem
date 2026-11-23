"use client"

import Image from "next/image"
import { LayoutDashboard } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { landingBannerImageUrl, type LandingBannerSlide } from "@/lib/landing-banner"

export function LandingBanner({ slides }: { slides: LandingBannerSlide[] }) {
  const [{ index, previous }, setPosition] = useState({ index: 0, previous: -1 })
  const [hovered, setHovered] = useState(false)
  const [failedSlides, setFailedSlides] = useState<string[]>([])
  const loaded = useRef(new Set<string>())
  const requested = useRef<number | null>(null)
  const count = slides.length
  const slide = slides[index]

  const show = useCallback((next: number) => {
    const target = slides[next]
    if (!target || failedSlides.includes(target.id)) return
    if (!loaded.current.has(target.id)) {
      requested.current = next
      return
    }
    requested.current = null
    setPosition((current) => current.index === next ? current : { index: next, previous: current.index })
  }, [slides, failedSlides])

  useEffect(() => {
    if (count < 2 || hovered) return
    const next = slides.findIndex((_, offset) => {
      const candidate = (index + offset + 1) % count
      return candidate !== index && !failedSlides.includes(slides[candidate].id)
    })
    if (next < 0) return
    const timer = window.setTimeout(() => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) show((index + next + 1) % count)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [count, index, hovered, slides, failedSlides, show])

  return (
    <section aria-label="TrackSphere banner" className="w-full space-y-3">
      <div
        className="relative aspect-video select-none overflow-hidden rounded-xl border bg-card"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {(!slide || failedSlides.includes(slide.id)) && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-gradient-to-br from-cyan-500/20 via-card to-blue-600/20 font-display text-2xl font-bold sm:text-3xl">
            <LayoutDashboard className="size-8 text-[var(--brand-primary-fixed)]" aria-hidden="true" />
            <span><span style={{ color: "var(--logo-track)" }}>Track</span><span style={{ color: "var(--logo-sphere)" }}>Sphere</span></span>
          </div>
        )}
        {slides.map((item, i) => !failedSlides.includes(item.id) && (
          <div
            key={item.revision}
            aria-hidden={i !== index}
            className={`absolute inset-0 bg-card ${i === index
              ? previous === -1 ? "z-20" : "z-20 motion-safe:animate-in motion-safe:slide-in-from-right-full motion-safe:duration-500"
              : i === previous
                ? "invisible z-10 motion-safe:visible motion-safe:animate-out motion-safe:slide-out-to-left-full motion-safe:duration-500"
                : "invisible"}`}
            style={{ animationFillMode: "both" }}
          >
            <Image
              src={landingBannerImageUrl(item)}
              alt={item.alt}
              fill
              unoptimized
              loading="eager"
              fetchPriority={i === 0 ? "high" : "low"}
              draggable={false}
              className="pointer-events-none object-cover"
              onLoad={() => {
                loaded.current.add(item.id)
                if (requested.current === i) show(i)
              }}
              onError={() => {
                if (requested.current === i) requested.current = null
                setFailedSlides((current) => [...current, item.id])
              }}
            />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((item, i) => (
            <button key={item.id} type="button" aria-label={`Show picture ${i + 1}`} aria-current={i === index ? "true" : undefined} disabled={failedSlides.includes(item.id)} onClick={() => show(i)} className="rounded-md p-2 disabled:opacity-40">
              <span className={`block size-2.5 rounded-full ${i === index ? "bg-[var(--brand-primary-fixed)]" : "bg-muted-foreground/50"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
