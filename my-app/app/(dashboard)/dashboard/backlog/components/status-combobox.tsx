"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
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
  disabled?: boolean
  canReopenCompleted?: boolean
  className?: string
  contentClassName?: string
}

export function StatusCombobox({
  value,
  onChange,
  disabled = false,
  canReopenCompleted = false,
  className,
  contentClassName,
}: StatusComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()
  const selectedOption = getStatusOption(value)

  if (value === "completed") {
    return (
      <AlertDialog open={open && canReopenCompleted && !disabled} onOpenChange={setOpen}>
        <button
          type="button"
          disabled={disabled || !canReopenCompleted}
          className={cn("inline-flex h-6 items-center rounded border px-1.5 text-[11px] font-medium", selectedOption.color, className)}
          aria-label={canReopenCompleted ? "Reopen completed task for revision" : "Completed task is locked"}
          title={canReopenCompleted ? "Reopen for revision" : "Completed task is locked"}
          onClick={() => setOpen(true)}
        >
          {selectedOption.label}
          {canReopenCompleted ? <ChevronsUpDown className="ml-2 h-3 w-3" /> : null}
        </button>
        <AlertDialogContent className="max-w-sm dark:border-[#343434] dark:bg-[#262626]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen task for revision?</AlertDialogTitle>
            <AlertDialogDescription>This will move the task to Revision and allow changes and submissions again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOpen(false); onChange("revision") }}>Reopen for revision</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

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
                    if (disabled) {
                      return
                    }

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
