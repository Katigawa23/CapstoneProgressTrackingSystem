"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { PageLoader } from "@/components/ui/page-loader"
import { saveClientAuthSession, type AuthenticatedUser } from "@/lib/auth-client"

type CompletionPayload = {
  user: AuthenticatedUser
  tenantId: string
}

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
    }, 150)

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
    <PageLoader
      title="Almost there..."
      description="Your dashboard is being prepared."
      message={statusMessage}
    />
  )
}
