import { Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function BacklogToolbar() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[190px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" />
        <Input
          placeholder="Search backlog..."
          className="pl-9 text-black placeholder:text-black/50"
        />
      </div>

      <Button variant="outline" className="gap-2 border-black/20 text-black">
        <SlidersHorizontal className="h-4 w-4 text-black" />
        Filter
      </Button>
    </div>
  )
}
