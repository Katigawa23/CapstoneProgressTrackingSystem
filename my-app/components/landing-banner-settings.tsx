"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LANDING_BANNER_MAX_BYTES, LANDING_BANNER_MAX_IMAGES, LANDING_BANNER_TYPES, landingBannerImageUrl, type LandingBannerSlide } from "@/lib/landing-banner"

export function LandingBannerSettings() {
  const [slides, setSlides] = useState<LandingBannerSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState<{ action: "add" | "replace" | "remove"; slide?: LandingBannerSlide }>()
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState("")
  const [mayCrop, setMayCrop] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/landing-banner", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (!controller.signal.aborted) {
        setSlides(data.slides)
        setLoaded(true)
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError("Could not load pictures. Refresh to try again.")
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function open(action: "add" | "replace" | "remove", slide?: LandingBannerSlide) {
    setError("")
    setPreview("")
    setMayCrop(false)
    setFile(undefined)
    setDraft({ action, slide })
  }

  async function save(action: "add" | "replace" | "remove" | "up" | "down", slide?: LandingBannerSlide) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      const body = new FormData()
      body.set("action", action)
      if (slide) body.set("id", slide.id)
      if ((action === "add" || action === "replace") && file) {
        body.set("image", file)
      }
      const response = await fetch("/api/landing-banner", { method: "POST", body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save the banner.")
      setSlides(data.slides)
      setDraft(undefined)
      setFile(undefined)
      setPreview("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the banner.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-display text-base font-semibold">Landing Page Banner</h2>
          <p className="mt-1 text-xs text-muted-foreground">Manage up to {LANDING_BANNER_MAX_IMAGES} public pictures. JPG, PNG, or WebP up to 2 MB each.</p>
        </div>
        <Button size="sm" disabled={!loaded || busy || slides.length >= LANDING_BANNER_MAX_IMAGES} onClick={() => open("add")}>Add picture</Button>
      </div>
      {error && !draft && <p role="alert" className="px-4 pt-3 text-sm text-destructive">{error}</p>}
      {loading && <p className="p-4 text-sm text-muted-foreground">Loading pictures…</p>}
      {loaded && !slides.length && <p className="p-4 text-sm text-muted-foreground">The landing page is displaying the default TrackSphere banner.</p>}
      {slides.length > 0 && <ul aria-label="Banner pictures" tabIndex={0} className="flex snap-x gap-3 overflow-x-auto p-4">
        {slides.map((slide) => (
          <li key={slide.id} className="w-56 max-w-full shrink-0 snap-start overflow-hidden rounded-lg border bg-background">
            <Image src={landingBannerImageUrl(slide)} alt="" width={224} height={126} unoptimized className="aspect-video w-full bg-muted object-cover" />
            <div className="flex flex-wrap items-center gap-1 px-2 pb-2 pt-1">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => open("remove", slide)}>Remove</Button>
            </div>
          </li>
        ))}
      </ul>}
      <Dialog open={Boolean(draft)} onOpenChange={(shown) => {
        if (!shown && !busy) {
          setDraft(undefined)
          setFile(undefined)
          setPreview("")
          setError("")
        }
      }}>
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{draft?.action === "remove" ? "Remove picture?" : draft?.action === "replace" ? "Replace picture" : "Add picture"}</DialogTitle>
            <DialogDescription>{draft?.action === "remove" ? "This picture will be removed from the public banner." : "Preview the picture before saving it to the public banner."}</DialogDescription>
          </DialogHeader>
          {draft && draft.action !== "remove" && (
            <div className="space-y-3">
              <Input type="file" aria-label="Banner picture" accept={LANDING_BANNER_TYPES} disabled={busy} onChange={(event) => {
                const next = event.target.files?.[0]
                setError("")
                setPreview("")
                setMayCrop(false)
                setFile(undefined)
                if (!next) return
                if (next.size > LANDING_BANNER_MAX_BYTES || !LANDING_BANNER_TYPES.split(",").includes(next.type)) {
                  event.target.value = ""
                  setError("Choose a JPG, PNG, or WebP image up to 2 MB.")
                  return
                }
                setFile(next)
              }} />
              {preview && <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                <Image
                  src={preview}
                  alt="Banner preview"
                  fill
                  unoptimized
                  className="object-cover"
                  onLoad={({ currentTarget }) => {
                    if (currentTarget.src === preview) {
                      setMayCrop(currentTarget.naturalWidth * 9 !== currentTarget.naturalHeight * 16)
                    }
                  }}
                />
              </div>}
              {preview && mayCrop && (
                <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-foreground">
                  This picture may be cropped. Use a 16:9 image, such as 1600 × 900 px, to show it in full.
                </p>
              )}
            </div>
          )}
          {error && draft && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => { setDraft(undefined); setFile(undefined); setPreview(""); setError("") }}>Cancel</Button>
            <Button variant={draft?.action === "remove" ? "destructive" : "default"} disabled={busy || !draft || (draft.action !== "remove" && !file)} onClick={() => { if (draft) void save(draft.action, draft.slide) }}>
              {busy ? "Saving…" : draft?.action === "remove" ? "Remove picture" : "Save picture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
