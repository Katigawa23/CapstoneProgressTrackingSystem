"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, CheckCheck, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Notification = { id: string; title: string; message: string; actorName: string | null; href: string; read: boolean; createdAt: string }

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TS"
}

export function NotificationMenu({ disabled = false }: { disabled?: boolean }) {
  const [items, setItems] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(false)
  const unread = items.filter((item) => !item.read).length

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      const data = await response.json()
      if (response.ok) setItems(data.notifications ?? [])
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => {
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const markRead = async (id?: string) => {
    setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read: true } : item))
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) })
  }

  return <DropdownMenu onOpenChange={(open) => { if (open) void load() }}>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Notifications" disabled={disabled} className="relative rounded-full text-slate-600 hover:text-[var(--brand-primary-fixed)] dark:text-slate-300">
      <Bell className="h-5 w-5" />{unread ? <span className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[min(420px,calc(100vw-1rem))] p-0">
      <div className="px-4 py-3"><DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel></div>
      <DropdownMenuSeparator className="m-0" />
      <div className="max-h-[420px] overflow-y-auto">
        {loading && !items.length ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div> : items.length ? items.map((item) => {
          const source = item.actorName?.trim() || "TrackSphere"
          return <Link key={item.id} href={item.href} onClick={() => void markRead(item.id)} className={`group block border-b px-4 py-3 text-left transition-colors hover:bg-muted/60 ${item.read ? "" : "bg-blue-500/5"}`}>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-[var(--brand-primary-fixed)] text-xs font-semibold text-white">{getInitials(source)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-semibold">{source}</p>
                  {!item.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" /> : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs font-medium">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(item.createdAt))}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
          </Link>
        }) : <p className="px-3 py-8 text-center text-xs text-muted-foreground">No notifications yet.</p>}
      </div>
      {items.length ? <><DropdownMenuSeparator className="m-0" /><div className="flex items-center justify-end px-4 py-2.5">{unread ? <button onClick={() => void markRead()} className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400"><CheckCheck className="h-4 w-4" />Mark all read</button> : <span className="text-xs text-muted-foreground">All caught up</span>}</div></> : null}
    </DropdownMenuContent>
  </DropdownMenu>
}
