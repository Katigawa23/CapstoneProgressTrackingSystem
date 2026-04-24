"use client"

import Link from "next/link"
import {
  BarChart3,
  CheckCircle2,
  FolderPlus,
  MessagesSquare,
  Users,
} from "lucide-react"
import { useLayoutEffect } from "react"

import AnimatedContent from "@/components/animated-content"
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

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) {
      return
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" })
    window.history.replaceState(null, "", `/#${sectionId}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800 dark:from-[#212121] dark:to-[#171717] dark:text-slate-100">
      <Navbar />

      <section
        id="hero"
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[92rem] items-center px-4 py-12 sm:px-6 md:py-16 lg:px-10 xl:px-14"
      >
        <div className="w-full max-w-3xl text-center md:pl-4 md:text-left xl:pl-6">
          <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <SplitText
              parts={[
                { text: "Track", className: "text-slate-950 dark:text-slate-50" },
                { text: "Sphere", className: "text-sky-600" },
              ]}
            />
            <ScrollReveal className="block" delay={340} yOffset={16}>
              <span className="block text-xl text-slate-600 dark:text-slate-300 sm:text-2xl md:text-3xl">
                Capstone & Thesis Progress Tracking
              </span>
            </ScrollReveal>
          </h1>

          <ScrollReveal className="mx-auto mt-6 max-w-md md:mx-0" delay={120}>
            <p className="text-base text-gray-600 dark:text-slate-300 sm:text-lg">
             Manage your capstone and thesis projects with ease through real-time tracking, smooth collaboration, and clear workflows.
            </p>
          </ScrollReveal>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <AnimatedContent
              className="sm:min-w-40"
              delay={0.2}
              direction="horizontal"
              duration={1.5}
              distance={56}
              initialOpacity={0}
              reverse
              scale={0.92}
            >
              <Button
                style={{
                  backgroundColor: "var(--brand-primary-fixed)",
                  color: "var(--brand-primary-fixed-foreground)",
                }}
                className="rounded-2xl px-6 py-5 text-base hover:opacity-90 sm:min-w-40"
                onClick={openLoginDialog}
              >
                Get Started
              </Button>
            </AnimatedContent>

            <AnimatedContent
              className="sm:min-w-40"
              delay={0.32}
              direction="horizontal"
              duration={1.5}
              distance={56}
              initialOpacity={0}
              scale={0.92}
            >
              <Button
                variant="outline"
                className="rounded-2xl px-6 py-5 text-base sm:min-w-40"
                onClick={() => scrollToSection("features")}
              >
                Learn More
              </Button>
            </AnimatedContent>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-[92rem] scroll-mt-24 px-4 py-16 sm:px-6 md:py-20 xl:px-8">
        <ScrollReveal>
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl md:mb-12">Features</h2>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-3">
          <ScrollReveal className="h-full" delay={40}>
            <Card className="h-full rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="flex h-full flex-col p-6">
                <BarChart3 className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 text-lg font-semibold">Progress Tracking</h3>
                <p className="text-sm text-gray-600">Track milestones and deadlines easily.</p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal className="h-full" delay={120}>
            <Card className="h-full rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="flex h-full flex-col p-6">
                <Users className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 text-lg font-semibold">Collaboration</h3>
                <p className="text-sm text-gray-600">
                  Work with advisers and group members seamlessly.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal className="h-full" delay={200}>
            <Card className="h-full rounded-2xl shadow-sm transition hover:shadow-md">
              <CardContent className="flex h-full flex-col p-6">
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

      <section id="how-it-works" className="scroll-mt-24 bg-white px-4 py-16 dark:bg-[#1d1d1d] sm:px-6 md:py-20 xl:px-8">
        <ScrollReveal>
          <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl md:mb-12">How It Works</h2>
        </ScrollReveal>

        <div className="mx-auto grid w-full max-w-[92rem] gap-8 text-center md:grid-cols-3">
          <ScrollReveal delay={40}>
            <div>
              <FolderPlus className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">1. Create Project</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                Start your capstone or thesis and define your goals.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div>
              <BarChart3 className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">2. Track Progress</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                Update tasks and monitor milestones.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div>
              <MessagesSquare className="mx-auto mb-4 text-blue-600" />
              <h3 className="font-semibold">3. Collaborate</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                Work with advisers and improve your project.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section id="about" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-16 text-center sm:px-6 md:py-20">
        <ScrollReveal>
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">About</h2>
        </ScrollReveal>
        <ScrollReveal className="mx-auto max-w-2xl" delay={40}>
          <p className="text-gray-600 dark:text-slate-300">
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
        className="mt-10 border-t border-blue-100 bg-white/75 text-slate-700 backdrop-blur dark:border-[#343434] dark:bg-[#1d1d1d]/95 dark:text-slate-300"
      >
        <div className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-7 sm:px-6 md:grid-cols-[1.2fr_0.8fr] xl:px-8">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              <span className="text-slate-950 dark:text-slate-50">Track</span>
              <span className="text-sky-600">Sphere</span>
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
              Manage milestones, submissions, and collaboration in one organized workspace.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Quick Links
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Link href="/" className="transition hover:text-slate-950 dark:hover:text-slate-50">
                Home
              </Link>
              <Link href="/#features" className="transition hover:text-slate-950 dark:hover:text-slate-50">
                Features
              </Link>
              <Link href="/#how-it-works" className="transition hover:text-slate-950 dark:hover:text-slate-50">
                How It Works
              </Link>
              <Link href="/#about" className="transition hover:text-slate-950 dark:hover:text-slate-50">
                About
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-blue-100 dark:border-slate-800">
          <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-2 px-4 py-3 text-center text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between md:text-left xl:px-8">
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
