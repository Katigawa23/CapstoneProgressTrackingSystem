"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { CustomLoader } from "@/components/ui/custom-loader"
import { saveClientAuthSession, type AuthenticatedUser } from "@/lib/auth-client"

type CompletionPayload = {
  user: AuthenticatedUser
  tenantId: string
}

const LOGIN_REDIRECT_DELAY_MS = 2500
const STATUS_MESSAGES = [
  "Initializing system...",
  "Preparing dashboard...",
  "Loading your workspace...",
] as const

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/")
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, "=")

  return atob(paddedValue)
}

function readCompletionPayload() {
  const hashValue = window.location.hash.replace(/^#/, "")
  const params = new URLSearchParams(hashValue)
  const encodedSession = params.get("session")
  const redirect = params.get("redirect")

  if (!encodedSession) {
    return null
  }

  try {
    return {
      payload: JSON.parse(decodeBase64Url(encodedSession)) as CompletionPayload,
      redirect: redirect && redirect.startsWith("/") ? redirect : "/dashboard",
    }
  } catch {
    return null
  }
}

export default function MicrosoftAuthCompletePage() {
  const router = useRouter()
  const [statusMessage, setStatusMessage] = useState<string>(STATUS_MESSAGES[0])

  useEffect(() => {
    const result = readCompletionPayload()

    if (!result?.payload?.user?.id || !result.payload.user.email || !result.payload.user.role) {
      router.replace("/?authError=callback")
      return
    }

    saveClientAuthSession(result.payload.user, result.payload.tenantId)
    router.prefetch(result.redirect)

    const timeoutId = window.setTimeout(() => {
      router.replace(result.redirect)
      router.refresh()
    }, LOGIN_REDIRECT_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [router])

  useEffect(() => {
    let currentIndex = 0

    const intervalId = window.setInterval(() => {
      currentIndex = (currentIndex + 1) % STATUS_MESSAGES.length
      setStatusMessage(STATUS_MESSAGES[currentIndex])
    }, 450)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(51,127,221,0.16),_transparent_45%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-6 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_40%),linear-gradient(180deg,_#171717_0%,_#101828_100%)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl border border-sky-100/80 bg-white/90 px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-slate-800 dark:bg-[#111827]/85 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="space-y-2">
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Almost there...
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your dashboard is being prepared.
          </p>
        </div>
        <CustomLoader size={80} color="#337FDD" aria-hidden="true" />
        <p className="min-h-5 text-sm font-medium text-sky-700 dark:text-sky-300">
          {statusMessage}
        </p>
      </div>
    </main>
  )
}
