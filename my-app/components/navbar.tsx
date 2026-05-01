"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import clsx from "clsx"

import { Button } from "@/components/ui/button"
import { ThemeSwitch } from "@/components/theme-switch"
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
  const [isAuthenticated] = useState(() => !!readClientAuthSession())

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

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
      window.history.replaceState(null, "", "/")
      setActiveHref("/")
      setIsMenuOpen(false)
      return
    }

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 shadow-sm backdrop-blur-md dark:border-[#343434] dark:bg-[#171717] dark:shadow-none">
      <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center justify-between px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>

              <SheetContent side="left" className="w-[85vw] max-w-sm border-border bg-background p-0">
              <SheetHeader className="border-b border-border px-5 py-5 text-left">
                <SheetTitle className="flex items-center gap-3 font-display text-xl">
                  <Image
                    src="/logoTS.png"
                    alt="TrackSphere logo"
                    width={30}
                    height={30}
                    className="h-7 w-7 object-contain"
                    priority
                  />
                  <span>
                    <span className="text-slate-950 dark:text-slate-50">Track</span>
                    <span className="text-sky-600">Sphere</span>
                  </span>
                </SheetTitle>
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

                <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Theme</p>                   
                  </div>
                  <ThemeSwitch iconOnly />
                </div>
              </div>

            </SheetContent>
          </Sheet>

          <Link
            href="/"
            onClick={handleLogoClick}
            className="flex items-center gap-3 font-display text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            <Image
              src="/logoTS.png"
              alt="TrackSphere logo"
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
            <span>
              <span className="text-slate-950 dark:text-slate-50">Track</span>
              <span className="text-sky-600">Sphere</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
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
              <Button
                style={{
                  backgroundColor: "var(--brand-primary-fixed)",
                  color: "var(--brand-primary-fixed-foreground)",
                }}
                className="px-4 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:opacity-90 hover:shadow-md sm:px-5 sm:text-base"
              >
                Login
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl tracking-tight">Login</DialogTitle>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-4">
                <MicrosoftLoginButton onSuccess={() => setIsLoginOpen(false)} />

                <Button variant="outline" className="w-full font-semibold">
                  Admin Login
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="hidden lg:block">
            <ThemeSwitch iconOnly />
          </div>
        </div>
      </div>
    </header>
  )
}
