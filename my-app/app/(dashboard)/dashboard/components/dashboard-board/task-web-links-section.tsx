import * as React from "react"

import { ChevronDown, Link2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"

type TaskWebLinksSectionProps = {
  links: Array<{
    url: string
    label: string
  }>
  onAddLink: (value: { url: string; label: string }) => void
  onRemoveLink: (value: { url: string; label: string }) => void
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
  onAddLink,
  onRemoveLink,
}: TaskWebLinksSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const [isCreatingLink, setIsCreatingLink] = React.useState(false)
  const [urlDraft, setUrlDraft] = React.useState("")
  const [labelDraft, setLabelDraft] = React.useState("")
  const createRowRef = React.useRef<HTMLDivElement | null>(null)

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
                {links.length}
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

        {links.length === 0 ? null : (
          <div className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-sm dark:border-[#3a3a3a] dark:bg-[#262626]">
            <div className="divide-y divide-slate-200 dark:divide-[#3a3a3a]">
              {links.map((link) => (
                <div
                  key={`${link.url}-${link.label}`}
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

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-tight text-slate-900 dark:text-slate-100">
                        {link.label || getHostname(link.url)}
                      </p>
                      <p className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                        {getHostname(link.url)}
                      </p>
                    </div>
                  </a>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    aria-label={`Remove ${link.label || link.url}`}
                    title="Delete"
                    onClick={() => onRemoveLink(link)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
