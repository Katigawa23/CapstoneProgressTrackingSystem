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
import { PriorityIcon } from "../../components/priority-icon"

type PriorityValue = "Low" | "Medium" | "High"

const priorityOptions: PriorityValue[] = ["Low", "Medium", "High"]

function getPriorityOptionClassName(priority: PriorityValue) {
  if (priority === "High") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
  }

  if (priority === "Low") {
    return "border-[color:rgba(var(--brand-primary-rgb),0.2)] bg-[color:rgba(var(--brand-primary-rgb),0.08)] text-[var(--brand-primary-fixed)] dark:border-[color:rgba(var(--brand-primary-rgb),0.35)] dark:bg-[color:rgba(var(--brand-primary-rgb),0.18)] dark:text-[#9bc2e2]"
  }

  return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300"
}

function getPriorityIconClassName(priority: PriorityValue) {
  if (priority === "High") {
    return "h-3.5 w-3.5 text-red-500"
  }

  if (priority === "Low") {
    return "h-3.5 w-3.5 text-[var(--brand-primary-fixed)]"
  }

  return "h-3.5 w-3.5 text-orange-500"
}

type PriorityComboboxProps = {
  value?: PriorityValue
  onChange: (value: PriorityValue) => void
  disabled?: boolean
}

export function PriorityCombobox({
  value = "Medium",
  onChange,
  disabled = false,
}: PriorityComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()

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
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "inline-flex h-6 min-w-[95px] items-center justify-between rounded border px-1.5 text-[11px] font-medium shadow-none outline-none transition-none focus:outline-none focus:ring-0 active:scale-100 disabled:cursor-not-allowed disabled:opacity-60",
            getPriorityOptionClassName(value)
          )}
        >
          <span className="flex items-center gap-1">
            <PriorityIcon priority={value} className={getPriorityIconClassName(value)} />
            {value}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[150px] p-1" align="end">
        <Command>
          <CommandList id={listId}>
            <CommandEmpty>No priority found.</CommandEmpty>
            <CommandGroup>
              {priorityOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    if (disabled) {
                      return
                    }

                    onChange(option)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-2 text-xs text-slate-900 dark:text-slate-100",
                    value === option
                      ? "bg-slate-100 dark:bg-[#343a42]"
                      : "data-[selected=true]:bg-slate-50 dark:data-[selected=true]:bg-[#2a2f36]"
                )}
              >
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                    <PriorityIcon
                      priority={option}
                      className={getPriorityIconClassName(option)}
                    />
                    {option}
                  </span>

                  <Check
                    className={cn(
                      "h-3.5 w-3.5 text-slate-600 dark:text-slate-200",
                      value === option ? "opacity-100" : "opacity-0"
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
