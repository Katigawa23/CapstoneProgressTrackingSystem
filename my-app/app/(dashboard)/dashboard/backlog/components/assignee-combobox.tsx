"use client"

import * as React from "react"
import { Check, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { assigneeOptions, getAssigneeOption } from "../types"

type AssigneeComboboxProps = {
  value?: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  className?: string
  contentClassName?: string
  avatarClassName?: string
  fallbackClassName?: string
  unassignedIconClassName?: string
}

export function AssigneeCombobox({
  value,
  onChange,
  disabled = false,
  className,
  contentClassName,
  avatarClassName,
  fallbackClassName,
  unassignedIconClassName,
}: AssigneeComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedAssignee = getAssigneeOption(value)
  const handleTriggerClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        event.preventDefault()
      }

      event.stopPropagation()
    },
    [disabled]
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) {
          return
        }

        setOpen(nextOpen)
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className={cn(
                  "h-7 w-7 rounded-full border border-slate-200 bg-white p-0 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60",
                  className
                )}
                onClick={handleTriggerClick}
              >
                {selectedAssignee?.initials ? (
                  <Avatar className={cn("h-7 w-7", avatarClassName)}>
                    <AvatarFallback
                      className={cn(
                        "text-[10px]",
                        fallbackClassName
                      )}
                    >
                      {selectedAssignee.initials}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User
                    className={cn("h-3.5 w-3.5 text-slate-500", unassignedIconClassName)}
                  />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {selectedAssignee ? (
            <TooltipContent sideOffset={6}>
              <p className="text-xs font-medium">{selectedAssignee.name}</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[210px] rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.1)]",
          contentClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Command className="rounded-lg bg-transparent">
          <CommandList>
            <CommandGroup className="p-0">
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  if (disabled) {
                    return
                  }

                  onChange(null)
                  setOpen(false)
                }}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-slate-900",
                  !value && "bg-slate-100"
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white">
                  <User className="h-3 w-3 text-slate-500" />
                </div>

                <div className="flex-1 text-[13px] font-medium">Unassigned</div>

                <Check
                  className={cn(
                    "h-4 w-4 text-slate-600",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>

              {assigneeOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    if (disabled) {
                      return
                    }

                    onChange(option.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "mt-1 flex min-h-9 items-start gap-2 rounded-md px-2 py-1.5 text-slate-900",
                    value === option.id && "bg-slate-100"
                  )}
                >
                  <Avatar className="mt-0.5 h-7 w-7">
                    <AvatarFallback className="text-[9px]">
                      {option.initials ?? "A"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 leading-tight">
                    <div className="text-[12px] leading-4 font-medium">{option.name}</div>
                    {option.email ? (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {option.email}
                      </div>
                    ) : null}
                  </div>

                  <Check
                    className={cn(
                      "mt-1 h-4 w-4 text-slate-600",
                      value === option.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
