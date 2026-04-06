"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import clsx from "clsx"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import MicrosoftLoginButton from "@/components/microsoft-login-button"
import { readClientAuthSession } from "@/lib/auth-client"

const navLinks = [
  { name: "Home", href: "/", sectionId: null },
  { name: "Features", href: "/#features", sectionId: "features" },
  { name: "How It Works", href: "/#how-it-works", sectionId: "how-it-works" },
  { name: "About", href: "/#about", sectionId: "about" },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeHref, setActiveHref] = useState("/")
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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
    const session = readClientAuthSession()
    setIsAuthenticated(!!session)
  }, [])

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isAuthenticated) {
      e.preventDefault()
      router.push("/dashboard/board")
    }
  }

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
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="border-b px-5 py-5 text-left">
                <SheetTitle className="font-display text-xl">
                  <span className="text-slate-950">Track</span>
                  <span className="text-sky-600">Sphere</span>
                </SheetTitle>
                <SheetDescription>Browse the landing page sections.</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-2 px-4 py-4">
                {navLinks.map((link) => {
                  const isActive = pathname === "/" && activeHref === link.href

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => {
                        setActiveHref(link.href)
                        setIsMenuOpen(false)
                      }}
                      className={clsx(
                        "rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        "hover:bg-primary/10 hover:text-primary",
                        isActive && "bg-primary/15 text-primary"
                      )}
                    >
                      {link.name}
                    </Link>
                  )
                })}
              </div>

            </SheetContent>
          </Sheet>

          <Link
            href="/"
            onClick={handleLogoClick}
            className="font-display text-xl font-bold tracking-tight sm:text-2xl"
          >
            <span className="text-slate-950">Track</span>
            <span className="text-sky-600">Sphere</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 lg:gap-8">
          <nav className="hidden items-center gap-2 text-sm font-medium lg:flex xl:gap-3 xl:text-base">
            {navLinks.map((link) => {
              const isActive = pathname === "/" && activeHref === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setActiveHref(link.href)}
                  className={clsx(
                    "rounded-lg px-3 py-2 transition-all duration-200 xl:px-4",
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
              <Button className="px-4 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md sm:px-5 sm:text-base">
                Login
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl">Login</DialogTitle>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-4">
                <MicrosoftLoginButton onSuccess={() => setIsLoginOpen(false)} />

                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">OR</span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" className="w-full font-semibold">
                  Admin Login
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Temporary local access while Microsoft login is unavailable.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
