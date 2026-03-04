"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import clsx from "clsx"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

function LoginDialog({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className={clsx(
            "font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md",
            triggerClassName
          )}
        >
          Login
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            Login
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <Button
            className="w-full font-semibold flex items-center justify-center gap-2"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            <Image
              src="/microsoft-logo.png"
              alt="Microsoft Logo"
              width={20}
              height={20}
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

          <Button
            variant="outline"
            className="w-full font-semibold"
            type="button"
          >
            Admin Login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Navbar() {
  const pathname = usePathname()

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Features", href: "/features" },
    
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <Link href="/" className="text-xl sm:text-2xl font-bold tracking-tight">
          MyApp
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-2 text-base font-medium">
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

          <LoginDialog />
        </div>

        {/* Mobile Burger */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="sr-only">
                  Menu
                </SheetTitle>
              </SheetHeader>

              {/* Centered Content */}
              <div className="mt-10 flex flex-col items-center gap-6">

                {/* Links */}
                <div className="flex w-full flex-col items-center gap-3">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={clsx(
                          "w-full max-w-[240px] text-center",
                          "px-4 py-3 rounded-lg text-base font-medium transition-all",
                          "hover:bg-primary/10 hover:text-primary",
                          isActive && "bg-primary/15 text-primary"
                        )}
                      >
                        {link.name}
                      </Link>
                    )
                  })}
                </div>

                {/* OR Separator */}
                <div className="w-full max-w-[240px]">
                  <div className="flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-xs text-muted-foreground font-medium">
                      OR
                    </span>
                    <Separator className="flex-1" />
                  </div>
                </div>

                {/* Login Button inside burger */}
                <div className="w-full max-w-[240px]">
                  <LoginDialog triggerClassName="w-full" />
                </div>

              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </header>
  )
}