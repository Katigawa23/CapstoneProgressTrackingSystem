"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { clearClientAuthSession } from "@/lib/auth-client"

export function VerificationRefresh() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  React.useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh() }, 15000)
    return () => window.clearInterval(timer)
  }, [router])
  return <><button disabled={pending} onClick={() => startTransition(() => router.refresh())} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm disabled:opacity-50"><RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />Check status</button><button onClick={async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    clearClientAuthSession()
    window.location.replace("/")
  }} className="mt-3 w-full text-center text-xs text-muted-foreground hover:underline">Sign out</button></>
}
