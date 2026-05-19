"use client"

import * as React from "react"
import { MoreHorizontal, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ItemActionsMenuProps = {
  onEdit: () => void
}

export function ItemActionsMenu({
  onEdit,
}: ItemActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-black/60 hover:bg-muted"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4" />
          Edit field
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
