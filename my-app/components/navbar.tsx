"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
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
  { name: "Home", href: "/", sectionId: null },
  { name: "Features", href: "/#features", sectionId: "features" },
  { name: "How It Works", href: "/#how-it-works", sectionId: "how-it-works" },
  { name: "About", href: "/#about", sectionId: "about" },
]

export default function Navbar() {
  const pathname = usePathname()
  const [activeHref, setActiveHref] = useState("/")
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  useEffect(() => {
    if (pathname !== "/") {
      return
    }

    const updateActiveLink = () => {
      const headerOffset = 96
      const activationLine = Math.max(
        headerOffset + 24,
        headerOffset + (window.innerHeight - headerOffset) * 0.45
      )
      const pageBottom = window.scrollY + window.innerHeight
      const pageHeight = document.documentElement.scrollHeight
      const sectionLinks = navLinks.filter(
        (link): link is (typeof navLinks)[number] & { sectionId: string } => Boolean(link.sectionId)
      )
      const footer = document.getElementById("site-footer")

      if (pageBottom >= pageHeight - 24) {
        setActiveHref(sectionLinks[sectionLinks.length - 1]?.href ?? "/")
        return
      }

      if (footer && footer.getBoundingClientRect().top <= window.innerHeight - 120) {
        setActiveHref("/#about")
        return
      }

      let nextActiveHref = "/"

      for (const link of sectionLinks) {
        const section = document.getElementById(link.sectionId)
        if (!section) continue

        if (section.getBoundingClientRect().top <= activationLine) {
          nextActiveHref = link.href
        }
      }

      setActiveHref(nextActiveHref)
    }

    updateActiveLink()
    window.addEventListener("scroll", updateActiveLink, { passive: true })
    window.addEventListener("hashchange", updateActiveLink)

    return () => {
      window.removeEventListener("scroll", updateActiveLink)
      window.removeEventListener("hashchange", updateActiveLink)
    }
  }, [pathname])

  useEffect(() => {
    const openLoginDialog = () => {
      setIsLoginOpen(true)
    }

    window.addEventListener("open-login-dialog", openLoginDialog)

    return () => {
      window.removeEventListener("open-login-dialog", openLoginDialog)
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 shadow-sm backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="font-display text-2xl font-bold tracking-tight">
          <span className="text-slate-950">Track</span>
          <span className="text-sky-600">Sphere</span>
        </Link>

        <div className="flex items-center gap-8">
          <nav className="hidden items-center gap-3 text-base font-medium md:flex">
            {navLinks.map((link) => {
              const isActive = pathname === "/" && activeHref === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setActiveHref(link.href)}
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

          <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
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
                <Button asChild className="flex w-full items-center justify-center gap-2 font-semibold">
                  <Link href="/dashboard">
                    <Image
                      src="/microsoft-logo.png"
                      alt="Microsoft Logo"
                      width={20}
                      height={20}
                      className="mr-2"
                    />
                    Login with Microsoft 365
                  </Link>
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
