"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Account = { userId: string; name: string; status: string }

export function useVerificationBulkActions({
  accounts, filter, saving, kind, begin, finish, onSaved,
}: {
  accounts: Account[]
  filter: string
  saving: boolean
  kind: "student" | "faculty"
  begin: () => boolean
  finish: () => void
  onSaved: (ids: Set<string>, status: "approved" | "revoked") => void
}) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [pending, setPending] = React.useState<{ accounts: Account[]; action: "revoked" | "restore" } | null>(null)
  const [result, setResult] = React.useState<{ saved: number; skipped: { id: string; name: string; reason: string }[] } | null>(null)
  const enabled = filter === "approved" || filter === "revoked"
  const shown = enabled ? accounts.filter((account) => account.status === filter && selected.has(account.userId)) : []
  const actionLabel = filter === "approved" ? "Revoke access" : "Restore access"

  async function confirm() {
    if (!pending || !begin()) return

    const saved = new Set<string>()
    const skipped: { id: string; name: string; reason: string }[] = []
    try {
      for (const account of pending.accounts) {
        const item = { id: account.userId, name: account.name }
        try {
          const response = await fetch(`/api/${kind}-verification`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [`${kind}Id`]: account.userId, status: pending.action }),
          })
          if (response.ok) {
            saved.add(account.userId)
          } else {
            const data = await response.json().catch(() => null) as { error?: string } | null
            skipped.push({ ...item, reason: data?.error || "The server could not confirm this update." })
          }
        } catch {
          skipped.push({ ...item, reason: "Connection lost. Refresh to confirm the account status." })
        }
      }
      onSaved(saved, pending.action === "restore" ? "approved" : "revoked")
      setResult({ saved: saved.size, skipped })
      setSelected(new Set())
      setPending(null)
    } finally {
      finish()
    }
  }

  return {
    clearSelection: () => setSelected(new Set()),
    checkbox: (account: Account) => enabled && (
      <Checkbox
        aria-label={`Select ${account.name}`}
        checked={selected.has(account.userId)}
        disabled={saving}
        onCheckedChange={(checked) => setSelected((current) => {
          const next = new Set(current)
          if (checked === true) next.add(account.userId)
          else next.delete(account.userId)
          return next
        })}
      />
    ),
    toolbar: enabled && accounts.length > 0 && (
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted/30 px-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="Select all shown"
              checked={shown.length === accounts.length ? true : shown.length ? "indeterminate" : false}
              disabled={saving}
              onCheckedChange={(checked) => setSelected(new Set(checked === true ? accounts.map((account) => account.userId) : []))}
            />
            Select all shown
          </label>
          <div className="flex items-center gap-3">
          {shown.length > 0 && <span className="text-xs text-muted-foreground">{shown.length} selected</span>}
          <Button size="sm" variant={filter === "approved" ? "destructive" : "default"} disabled={saving || !shown.length} onClick={() => {
            setResult(null)
            setPending({ accounts: shown, action: filter === "approved" ? "revoked" : "restore" })
          }}>{actionLabel}</Button>
          </div>
        </div>
    ),
    controls: <>
      {result && (
        <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
          <p>{result.saved} updated. {result.skipped.length} skipped or unconfirmed.</p>
          {result.skipped.length > 0 && <ul className="list-disc space-y-1 pl-5">
            {result.skipped.map((item) => <li key={item.id}><strong>{item.name}</strong> — {item.reason}</li>)}
          </ul>}
        </div>
      )}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !saving) setPending(null) }}>
        <DialogContent showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>{pending?.action === "revoked" ? "Revoke access?" : "Restore access?"}</DialogTitle>
            <DialogDescription>
              {pending?.accounts.length} selected account(s). {pending?.action === "revoked"
                ? "These users will lose access and be signed out. Their work history will be kept."
                : "These users will regain access to TrackSphere."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending?.action === "revoked" ? "destructive" : "default"} disabled={saving} onClick={() => void confirm()}>
              {saving ? "Updating…" : pending?.action === "revoked" ? "Revoke access" : "Restore access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
  }
}
