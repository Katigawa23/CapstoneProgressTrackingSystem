import * as React from "react"

import { Archive, ChevronDown, Ellipsis, Filter, Link2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { getAssigneeOption } from "../../backlog/types"
import type { DashboardWebLink } from "../../types"

type TaskWebLinksSectionProps = {
  links: DashboardWebLink[]
  currentUserId?: string | null
  creatorNamesById?: Record<string, string>
  canManageOtherProjectResources?: boolean
  onAddLink: (value: { url: string; label: string }) => void | Promise<void>
  onArchiveLink: (value: DashboardWebLink) => void | Promise<void>
}

type ResourceFilterOption = {
  id: string
  label: string
  detail?: string
  initials: string
}

function getFilterInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U"
}

function normalizeUrl(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ""
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue
  }

  return `https://${trimmedValue}`
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

function getFaviconUrl(value: string) {
  try {
    const url = new URL(value)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
  } catch {
    return ""
  }
}

export function TaskWebLinksSection({
  links,
  currentUserId = null,
  creatorNamesById = {},
  canManageOtherProjectResources = false,
  onAddLink,
  onArchiveLink,
}: TaskWebLinksSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [isCreatingLink, setIsCreatingLink] = React.useState(false)
  const [urlDraft, setUrlDraft] = React.useState("")
  const [labelDraft, setLabelDraft] = React.useState("")
  const [creatorFilter, setCreatorFilter] = React.useState("all")
  const createRowRef = React.useRef<HTMLDivElement | null>(null)
  const normalizedCurrentUserId = currentUserId?.trim() ?? ""
  const creatorOptions = React.useMemo<ResourceFilterOption[]>(() => {
    const options = new Map<string, string>()

    for (const link of links) {
      const uploadedByUserId = link.uploadedByUserId?.trim()

      if (!uploadedByUserId) {
        continue
      }

      const assigneeOption = getAssigneeOption(uploadedByUserId)
      const label =
        uploadedByUserId === normalizedCurrentUserId
          ? "To me"
          : assigneeOption?.name ?? creatorNamesById[uploadedByUserId] ?? uploadedByUserId
      const detail =
        uploadedByUserId === normalizedCurrentUserId
          ? assigneeOption?.email ?? creatorNamesById[uploadedByUserId]
          : assigneeOption?.email

      options.set(
        uploadedByUserId,
        JSON.stringify({
          detail,
          initials: assigneeOption?.initials ?? getFilterInitials(label),
          label,
        })
      )
    }

    return Array.from(options, ([id, value]) => {
      const option = JSON.parse(value) as Omit<ResourceFilterOption, "id">
      return { id, ...option }
    }).sort((left, right) => {
      if (left.id === normalizedCurrentUserId) {
        return -1
      }

      if (right.id === normalizedCurrentUserId) {
        return 1
      }

      return left.label.localeCompare(right.label)
    })
  }, [creatorNamesById, links, normalizedCurrentUserId])
  const visibleLinks = React.useMemo(
    () =>
      creatorFilter === "all"
        ? links
        : links.filter((link) => link.uploadedByUserId?.trim() === creatorFilter),
    [creatorFilter, links]
  )

  React.useEffect(() => {
    if (!isCreatingLink) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!createRowRef.current?.contains(event.target as Node)) {
        setIsCreatingLink(false)
        setUrlDraft("")
        setLabelDraft("")
      }
    }

    document.addEventListener("mousedown", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [isCreatingLink])

  const commitLink = React.useCallback(() => {
    const nextUrl = normalizeUrl(urlDraft)
    const nextLabel = labelDraft.trim()

    if (!nextUrl) {
      setIsCreatingLink(false)
      setUrlDraft("")
      setLabelDraft("")
      return
    }

    onAddLink({
      url: nextUrl,
      label: nextLabel,
    })
    setIsCreatingLink(false)
    setUrlDraft("")
    setLabelDraft("")
  }, [labelDraft, onAddLink, urlDraft])

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="mt-4 space-y-3"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="space-y-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-left text-slate-900 transition hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} web links`}
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isExpanded ? "rotate-0" : "-rotate-90"
                }`}
              />
              <span className="text-[15px] font-semibold">Web Link</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-[#343434] dark:text-slate-300">
                {visibleLinks.length}
              </span>
            </button>
          </CollapsibleTrigger>
          {isExpanded ? (
            <p className="pl-6 text-sm text-slate-500 dark:text-slate-400">
              Add reference links related to this task.
            </p>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`relative h-9 w-9 rounded-[2px] p-0 dark:border-[#3a3a3a] dark:bg-[#262626] dark:hover:bg-[#303030] ${
                  creatorFilter === "all"
                    ? "text-slate-700 dark:text-slate-200"
                    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
                }`}
                aria-label="Filter web links"
                title="Filter web links"
              >
                <Filter className="h-4 w-4" />
                {creatorFilter !== "all" ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white">
                    1
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Created by
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200">
                  <DropdownMenuItem onSelect={() => setCreatorFilter("all")}>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[9px]">
                        All
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">All members</span>
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        Created by anyone
                      </span>
                    </span>
                  </DropdownMenuItem>
                  {creatorOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => setCreatorFilter(option.id)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[9px]">
                          {option.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{option.label}</span>
                        {option.detail ? (
                          <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {option.detail}
                          </span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          {creatorFilter !== "all" ? (
            <button
              type="button"
              className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              onClick={() => setCreatorFilter("all")}
            >
              Clear filters
            </button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-9 w-9 rounded-[2px] p-0 hover:opacity-90"
            style={{
              backgroundColor: "var(--brand-primary-fixed)",
              color: "var(--brand-primary-fixed-foreground)",
            }}
            aria-label="Add web link"
            title="Add web link"
            onClick={() => {
              setIsExpanded(true)
              setIsCreatingLink(true)
              setUrlDraft("")
              setLabelDraft("")
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CollapsibleContent className="space-y-2">
        {isCreatingLink ? (
          <div
            ref={createRowRef}
            className="space-y-2"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  URL
                </label>
                <Input
                  value={urlDraft}
                  onChange={(event) => setUrlDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      commitLink()
                    }

                    if (event.key === "Escape") {
                      setIsCreatingLink(false)
                      setUrlDraft("")
                      setLabelDraft("")
                    }
                  }}
                  autoFocus
                  placeholder="https://www.example.com"
                  className="h-8 border-slate-200 bg-white text-[13px] text-slate-900 dark:border-[#454545] dark:bg-[#1f1f1f] dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Link text
                </label>
                <Input
                  value={labelDraft}
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      commitLink()
                    }

                    if (event.key === "Escape") {
                      setIsCreatingLink(false)
                      setUrlDraft("")
                      setLabelDraft("")
                    }
                  }}
                  placeholder="Add a description..."
                  className="h-8 border-slate-200 bg-white text-[13px] text-slate-900 dark:border-[#454545] dark:bg-[#1f1f1f] dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-[12px]"
                onClick={commitLink}
              >
                Link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2.5 text-[12px]"
                onClick={() => {
                  setIsCreatingLink(false)
                  setUrlDraft("")
                  setLabelDraft("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {links.length === 0 ? null : visibleLinks.length === 0 ? (
          <div className="rounded-[2px] border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-400">
            No web links match this filter.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#262626]">
            <div className="divide-y divide-slate-200 dark:divide-[#3a3a3a]">
              {visibleLinks.map((link) => {
                const canManageLink =
                  Boolean(currentUserId?.trim()) &&
                  (
                    link.uploadedByUserId === currentUserId?.trim() ||
                    canManageOtherProjectResources
                  )

                return (
                <div
                  key={link.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-[#2c2c2c]"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[2px]"
                    title={link.url}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-slate-200 bg-slate-100 dark:border-[#454545] dark:bg-[#1f1f1f]">
                      {getFaviconUrl(link.url) ? (
                        <img
                          src={getFaviconUrl(link.url)}
                          alt=""
                          className="h-3.5 w-3.5"
                          onError={(event) => {
                            event.currentTarget.style.display = "none"
                            const sibling = event.currentTarget.nextElementSibling as HTMLElement | null
                            if (sibling) {
                              sibling.style.display = "flex"
                            }
                          }}
                        />
                      ) : null}
                      <span
                        className="hidden h-3.5 w-3.5 items-center justify-center text-slate-500 dark:text-slate-400"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p
                        className="truncate text-[12px] font-medium leading-tight text-slate-900 dark:text-slate-100"
                        title={link.label || getHostname(link.url)}
                      >
                        {link.label || getHostname(link.url)}
                      </p>
                      <p
                        className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400"
                        title={getHostname(link.url)}
                      >
                        {getHostname(link.url)}
                      </p>
                    </div>
                  </a>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#343434] dark:hover:text-slate-200"
                        aria-label={`Open actions for ${link.label || link.url}`}
                        title="Actions"
                      >
                        <Ellipsis className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-36 border-slate-200 bg-white text-slate-700 dark:border-[#343434] dark:bg-[#262626] dark:text-slate-200"
                    >
                      <DropdownMenuItem asChild>
                        <a href={link.url} target="_blank" rel="noreferrer">
                          <Link2 className="h-4 w-4" />
                          Open
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManageLink}
                        onSelect={() => void onArchiveLink(link)}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )})}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
