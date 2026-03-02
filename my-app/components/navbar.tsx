"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import clsx from "clsx"
import { Separator } from "./ui/separator"

export default function Navbar() {
  const pathname = usePathname()

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Features", href: "/features" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">

        {/* Logo */}
        <Link href="/" className="text-2xl font-bold tracking-tight">
          MyApp
        </Link>

        {/* Right Side */}
        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-3 text-base font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "px-4 py-2 rounded-lg transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary",
                    isActive && "bg-primary/15 text-primary"
                  )}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          {/* LOGIN POPUP */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="font-semibold  transition-all duration-200 hover:scale-105 hover:shadow-md">
                Login
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  Login
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-4 mt-4">
                <Button className="w-full font-semibold flex items-center justify-center gap-2">
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
                         <span className="text-xs text-muted-foreground font-medium">
                             OR
                         </span>
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