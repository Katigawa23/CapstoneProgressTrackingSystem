"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { saveClientAuthSession, type AuthenticatedUser } from "@/lib/auth-client"

type CompletionPayload = {
  user: AuthenticatedUser
  tenantId: string
}

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/")
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, "=")

  return atob(paddedValue)
}

function readCompletionPayload() {
  const hashValue = window.location.hash.replace(/^#/, "")
  const params = new URLSearchParams(hashValue)
  const encodedSession = params.get("session")

  if (!encodedSession) {
    return null
  }

  try {
    return JSON.parse(decodeBase64Url(encodedSession)) as CompletionPayload
  } catch {
    return null
  }
}

export default function MicrosoftAuthCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const payload = readCompletionPayload()

    if (!payload?.user?.id || !payload.user.email) {
      router.replace("/?authError=callback")
      return
    }

    saveClientAuthSession(payload.user, payload.tenantId)
    router.replace("/dashboard")
    router.refresh()
  }, [router])

  return null
}
