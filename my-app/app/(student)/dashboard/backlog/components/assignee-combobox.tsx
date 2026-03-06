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

import { assigneeOptions, getAssigneeOption } from "../types"

type AssigneeComboboxProps = {
  value?: string | null
  onChange: (value: string | null) => void
}

export function AssigneeCombobox({
  value,
  onChange,
}: AssigneeComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedAssignee = getAssigneeOption(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full border border-black/15 p-0 hover:bg-muted"
        >
          {selectedAssignee?.initials ? (
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] font-medium">
                {selectedAssignee.initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-3.5 w-3.5 text-black/50" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[320px] p-1">
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="flex items-center gap-3 rounded-md px-2 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-background">
                  <User className="h-4 w-4 text-black/50" />
                </div>

                <div className="flex-1 text-sm font-medium">Unassigned</div>

                <Check
                  className={cn(
                    "h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>

              {assigneeOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                  className="flex items-start gap-3 rounded-md px-2 py-2"
                >
                  <Avatar className="mt-0.5 h-8 w-8">
                    <AvatarFallback className="text-[11px] font-medium">
                      {option.initials ?? "A"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 leading-tight">
                    <div className="text-sm font-medium">{option.name}</div>
                    {option.email ? (
                      <div className="text-xs text-muted-foreground">
                        {option.email}
                      </div>
                    ) : null}
                  </div>

                  <Check
                    className={cn(
                      "mt-1 h-4 w-4",
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