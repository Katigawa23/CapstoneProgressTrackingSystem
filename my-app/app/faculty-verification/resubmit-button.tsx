"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
export function FacultyResubmitButton({ retryAt }: { retryAt: string | null }) {
  const router = useRouter()
  const lock = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [blockedUntil, setBlockedUntil] = React.useState(retryAt)
  React.useEffect(() => setBlockedUntil(retryAt), [retryAt])
  async function submit() {
    if (lock.current || (blockedUntil && Date.parse(blockedUntil)>Date.now())) return
    lock.current=true; setSaving(true); setError("")
    try {
      const response = await fetch("/api/faculty-verification/resubmit", { method: "POST" })
      const data = await response.json()
      if (response.status === 429) setBlockedUntil(data.retryAt ?? null)
      if (!response.ok) throw new Error(data.error || "Could not submit your request.")
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your request.")
    } finally { lock.current=false; setSaving(false) }
  }
  const blocked = blockedUntil !== null && Date.parse(blockedUntil)>Date.now()
  return <div className="mt-4 space-y-2">
    <Button className="w-full" disabled={saving || blocked} onClick={() => void submit()}>{saving ? "Sending request..." : "Request verification again"}</Button>
    {blocked && blockedUntil ? <p className="text-xs text-amber-600 dark:text-amber-400">Next attempt: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(blockedUntil))} (Philippine time).</p> : null}
    {error ? <p role="alert" className="text-xs text-red-500">{error}</p> : null}
  </div>
}
