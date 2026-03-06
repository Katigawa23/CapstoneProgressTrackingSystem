import { Search } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

type Person = {
  name: string
  src: string
}

type DashboardHeaderProps = {
  people: Person[]
}

export function DashboardHeader({ people }: DashboardHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        Title / <span className="text-foreground">Travel Booking App</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Board</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-full pl-8 text-xs" placeholder="Search" />
          </div>

          <div className="flex items-center">
            {people.map((person, index) => (
              <Avatar
                key={person.name}
                className={`h-5 w-5 ring-2 ring-background ${
                  index === 0 ? "" : "-ml-1.5"
                }`}
              >
                <AvatarImage src={person.src} alt={person.name} />
                <AvatarFallback className="text-[8px]">
                  {person.name}
                </AvatarFallback>
              </Avatar>
            ))}

            <Avatar className="h-5 w-5 ring-2 ring-background -ml-1.5">
              <AvatarFallback className="text-[8px]">+</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  )
}
