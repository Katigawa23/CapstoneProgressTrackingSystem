"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { getStatusOption, statusOptions } from "../types"

type StatusComboboxProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  contentClassName?: string
}

export function StatusCombobox({
  value,
  onChange,
  className,
  contentClassName,
}: StatusComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()
  const selectedOption = getStatusOption(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          className={cn(
            "inline-flex h-6 min-w-[95px] items-center justify-between rounded border px-1.5 text-[11px] font-medium shadow-none outline-none transition-none focus:outline-none focus:ring-0 active:scale-100",
            selectedOption.color,
            className
          )}
        >
          <span>{selectedOption.label}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className={cn("w-[150px] p-1", contentClassName)} align="end">
        <Command>
          <CommandList id={listId}>
            <CommandEmpty>No status found.</CommandEmpty>
            <CommandGroup>
              {statusOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between px-1 py-1 text-xs"
                >
                  <span
                    className={cn(
                      "rounded border px-1.5 py-[2px] text-[11px] font-medium",
                      option.color
                    )}
                  >
                    {option.label}
                  </span>

                  <Check
                    className={cn(
                      "h-3 w-3",
                      value === option.value ? "opacity-100" : "opacity-0"
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
