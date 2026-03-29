"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "About", href: "#about" },
  { name: "Features", href: "#features" },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 shadow-sm backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          CapstoneTrack
        </Link>

        <div className="flex items-center gap-8">
          <nav className="hidden items-center gap-3 text-base font-medium md:flex">
            {navLinks.map((link) => {
              const isSectionLink = link.href.startsWith("#")
              const isActive = !isSectionLink && pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-lg px-4 py-2 transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary",
                    isActive && "bg-primary/15 text-primary"
                  )}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md">
                Login
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl">Login</DialogTitle>
                <DialogDescription>
                  Sign in to manage your capstone workspace.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-4">
                <Button className="flex w-full items-center justify-center gap-2 font-semibold">
                  <Image
                    src="/microsoft-logo.png"
                    alt="Microsoft Logo"
                    width={20}
                    height={20}
                    className="mr-2"
                  />
                  Login with Microsoft 365
                </Button>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">OR</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" className="w-full font-semibold">
                  Admin Login
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
