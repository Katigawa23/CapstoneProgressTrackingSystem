"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"

export default function MicrosoftLoginButton({
  onSuccess,
}: {
  onSuccess?: () => void
}) {
  return (
    <Button
      type="button"
      style={{
        backgroundColor: "var(--brand-primary-fixed)",
        color: "var(--brand-primary-fixed-foreground)",
      }}
      className="flex w-full items-center justify-center gap-2 font-semibold hover:opacity-90"
      onClick={() => {
        onSuccess?.()
        window.location.assign("/api/auth/microsoft")
      }}
    >
      <Image
        src="/microsoft-logo.png"
        alt="Microsoft Logo"
        width={20}
        height={20}
        className="mr-1"
      />
      Login with Microsoft 365
    </Button>
  )
}
