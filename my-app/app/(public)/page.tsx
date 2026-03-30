"use client"

import Link from "next/link"
import { BarChart3, CheckCircle2, FolderPlus, MessagesSquare, Users } from "lucide-react"
import { useLayoutEffect } from "react"

import Navbar from "@/components/navbar"
import ScrollReveal from "@/components/scroll-reveal"
import SplitText from "@/components/split-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LandingPage() {
  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" })

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  const openLoginDialog = () => {
    window.dispatchEvent(new Event("open-login-dialog"))
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800">
      <Navbar />

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-12 md:py-16">
        <div className="text-center md:text-left">
          <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <SplitText
              parts={[
                { text: "Track", className: "text-slate-950" },
                { text: "Sphere", className: "text-sky-600" },
              ]}
            />
            <ScrollReveal className="block" delay={340} yOffset={16}>
              <span className="block text-xl text-slate-600 sm:text-2xl md:text-3xl">
                Capstone Progress System
              </span>
            </ScrollReveal>
          </h1>

          <ScrollReveal className="mx-auto mt-6 max-w-md md:mx-0" delay={120}>
            <p className="text-base text-gray-600 sm:text-lg">
              A smarter way to manage your research and capstone projects with real-time
              tracking, collaboration, and structured workflows.
            </p>
          </ScrollReveal>

          <ScrollReveal
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start"
            delay={240}
          >
            <Button
              className="rounded-2xl px-6 py-5 text-base sm:min-w-40"
              onClick={openLoginDialog}
            >
              Get Started
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-2xl px-6 py-5 text-base sm:min-w-40"
            >
              <Link href="/#features">Learn More</Link>
            </Button>
          </ScrollReveal>
        </div>

        <ScrollReveal className="flex items-center justify-center" delay={360}>
          <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-white text-center text-gray-400 shadow-sm sm:h-72 md:h-80">
            Dashboard Preview
          </div>
        </ScrollReveal>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 md:py-20">
        <ScrollReveal>
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl md:mb-12">Features</h2>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          <ScrollReveal delay={40}>
            <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="p-6">
                <BarChart3 className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 text-lg font-semibold">Progress Tracking</h3>
                <p className="text-sm text-gray-600">Track milestones and deadlines easily.</p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="p-6">
                <Users className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 text-lg font-semibold">Collaboration</h3>
                <p className="text-sm text-gray-600">
                  Work with advisers and team members seamlessly.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="p-6">
                <CheckCircle2 className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 text-lg font-semibold">Task Management</h3>
                <p className="text-sm text-gray-600">
                  Organize submissions and revisions efficiently.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 md:py-20">
        <ScrollReveal>
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl md:mb-12">How It Works</h2>
        </ScrollReveal>

        <div className="mx-auto grid max-w-6xl gap-8 text-center md:grid-cols-3">
          <ScrollReveal delay={40}>
            <div>
              <FolderPlus className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">1. Create Project</h3>
              <p className="mt-2 text-sm text-gray-600">
                Start your capstone and define your goals.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div>
              <BarChart3 className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">2. Track Progress</h3>
              <p className="mt-2 text-sm text-gray-600">
                Update tasks and monitor milestones.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div>
              <MessagesSquare className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">3. Collaborate</h3>
              <p className="mt-2 text-sm text-gray-600">
                Work with advisers and improve your project.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 text-center sm:px-6 md:py-20">
        <ScrollReveal>
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">About</h2>
        </ScrollReveal>
        <ScrollReveal className="mx-auto max-w-2xl" delay={40}>
          <p className="text-gray-600">
            TrackSphere helps students and advisers keep projects organized, visible, and moving
            with a clearer and more structured workflow.
          </p>
        </ScrollReveal>
        <ScrollReveal className="mx-auto mt-4 max-w-2xl" delay={120}>
          <p className="text-sm leading-7 text-slate-500">
            It brings tasks, milestones, updates, and collaboration into one simple workspace.
            With a clearer view of progress, teams stay focused while advisers can guide each
            project more smoothly.
          </p>
        </ScrollReveal>
      </section>

      <footer
        id="site-footer"
        className="mt-10 border-t border-blue-100 bg-white/75 text-slate-700 backdrop-blur"
      >
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              <span className="text-slate-950">Track</span>
              <span className="text-sky-600">Sphere</span>
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              Manage milestones, submissions, and collaboration in one organized workspace.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Quick Links
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Link href="/" className="transition hover:text-slate-950">
                Home
              </Link>
              <Link href="/#features" className="transition hover:text-slate-950">
                Features
              </Link>
              <Link href="/#how-it-works" className="transition hover:text-slate-950">
                How It Works
              </Link>
              <Link href="/#about" className="transition hover:text-slate-950">
                About
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-blue-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-center text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between md:text-left">
            <p>
              {"(c)"} {new Date().getFullYear()} TrackSphere
            </p>
            <p>Built for students and advisers.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
