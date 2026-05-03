"use client"

import Link from "next/link"
import { BarChart3, CheckCircle2, ClipboardList, Clock3, FolderPlus, LayoutGrid, MessagesSquare, Target, Users } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import AnimatedContent from "@/components/animated-content"
import Navbar from "@/components/navbar"
import ScrollReveal from "@/components/scroll-reveal"
import SplitText from "@/components/split-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

const featureCards = [
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description: "Track milestones and deadlines easily.",
  },
  {
    icon: Users,
    title: "Collaboration",
    description: "Work with advisers and group members seamlessly.",
  },
  {
    icon: CheckCircle2,
    title: "Task Management",
    description: "Organize submissions and revisions efficiently.",
  },
  {
    icon: ClipboardList,
    title: "Backlog Module",
    description: "Manage the task backlog where work items can be created, edited, and prioritized.",
  },
  {
    icon: FolderPlus,
    title: "Project Workspace",
    description: "Support multiple capstone or thesis projects from a dedicated project selection view.",
  },
  {
    icon: LayoutGrid,
    title: "Kanban Board",
    description: "Move tasks across to-do, in progress, revision, and completed board columns.",
  },
  {
    icon: Target,
    title: "Milestones",
    description: "Track milestone-based deliverables for each project phase, even if the screen is still being expanded.",
  },
  {
    icon: Clock3,
    title: "Roadmap",
    description: "Outline the project timeline and planned direction through the roadmap section.",
  },
  {
    icon: Users,
    title: "Members",
    description: "Organize team-member information and collaboration roles in the members area.",
  },
]

const howItWorksSteps = [
  {
    icon: FolderPlus,
    title: "1. Create Project",
    description: "Start your capstone or thesis and define your goals.",
  },
  {
    icon: BarChart3,
    title: "2. Track Progress",
    description: "Update tasks and monitor milestones.",
  },
  {
    icon: MessagesSquare,
    title: "3. Collaborate",
    description: "Work with advisers and improve your project.",
  },
  {
    icon: ClipboardList,
    title: "4. Organize Tasks",
    description: "Build a backlog of work items and prepare tasks before execution starts.",
  },
  {
    icon: LayoutGrid,
    title: "5. Manage Workflow",
    description: "Move tasks through kanban board stages to keep the project workflow visible.",
  },
  {
    icon: Target,
    title: "6. Reach Milestones",
    description: "Stay focused on deliverables and timelines until each milestone is completed.",
  },
]

export default function LandingPage() {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [activeFeatureGroup, setActiveFeatureGroup] = useState(0)
  const [revealedHowItWorksCount, setRevealedHowItWorksCount] = useState(0)
  const howItWorksRef = useRef<HTMLElement | null>(null)

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

  useEffect(() => {
    if (!carouselApi) {
      return
    }

    const updateActiveGroup = () => {
      setActiveFeatureGroup(Math.floor(carouselApi.selectedScrollSnap() / 3))
    }

    updateActiveGroup()
    carouselApi.on("select", updateActiveGroup)
    carouselApi.on("reInit", updateActiveGroup)

    return () => {
      carouselApi.off("select", updateActiveGroup)
      carouselApi.off("reInit", updateActiveGroup)
    }
  }, [carouselApi])

  useEffect(() => {
    const element = howItWorksRef.current
    if (!element) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let currentIndex = 0

    const revealNextStep = () => {
      currentIndex += 1
      setRevealedHowItWorksCount(currentIndex)

      if (currentIndex < howItWorksSteps.length) {
        timeoutId = setTimeout(revealNextStep, 180)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }

        observer.unobserve(element)
        revealNextStep()
      },
      { threshold: 0.2 }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  const featureGroupCount = Math.ceil(featureCards.length / 3)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800 dark:from-[#212121] dark:to-[#171717] dark:text-slate-100">
      <Navbar />

      <section
        id="hero"
        className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[92rem] content-center items-start gap-6 px-4 py-8 sm:px-6 md:gap-14 md:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:px-10 xl:px-14"
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

        <div className="relative mx-auto mt-2 w-full max-w-xl lg:hidden">
          <AnimatedContent
            delay={0.36}
            direction="vertical"
            duration={1.2}
            distance={28}
            initialOpacity={0}
            scale={0.97}
          >
            <Card className="min-h-[13rem] rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.24)] backdrop-blur">
              <CardContent className="flex h-full min-h-[13rem] items-center justify-center p-5 sm:p-6">
                <div className="h-full w-full rounded-xl border border-dashed border-sky-200/90 bg-[linear-gradient(135deg,rgba(224,242,254,0.7),rgba(255,255,255,0.9))] dark:border-sky-900/70 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.38),rgba(15,23,42,0.82))]" />
              </CardContent>
            </Card>
          </AnimatedContent>
        </div>

        <div className="relative mx-auto hidden w-full max-w-3xl lg:block">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.16),_transparent_64%)] blur-3xl" />
          <AnimatedContent
            delay={0.28}
            direction="horizontal"
            duration={1.2}
            distance={32}
            initialOpacity={0}
            scale={0.94}
          >
            <Card className="min-h-[22rem] rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.24)] backdrop-blur">
              <CardContent className="flex h-full min-h-[22rem] items-center justify-center p-8">
                <div className="h-full w-full rounded-xl border border-dashed border-sky-200/90 bg-[linear-gradient(135deg,rgba(224,242,254,0.7),rgba(255,255,255,0.9))] dark:border-sky-900/70 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.38),rgba(15,23,42,0.82))]" />
              </CardContent>
            </Card>
          </AnimatedContent>
        </div>

      </section>

      <section id="features" className="mx-auto w-full max-w-[92rem] scroll-mt-24 px-4 py-16 sm:px-6 md:py-20 xl:px-8">
        <ScrollReveal>
          <div className="mb-10 text-center md:mb-12">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
              <SplitText
                parts={[
                  { text: " Features", className: "text-slate-900 dark:text-slate-50" },
                ]}
              />
            </h2>
            <ScrollReveal className="mx-auto mt-4 max-w-2xl" delay={120}>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                Explore the core tools that help students and advisers manage projects, organize work, and track progress in one workspace.
              </p>
            </ScrollReveal>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <Carousel
            setApi={setCarouselApi}
            opts={{ align: "start", loop: false }}
            className="mx-auto w-full"
          >
            <CarouselContent className="-ml-4">
              {featureCards.map((feature) => {
                const Icon = feature.icon

                return (
                  <CarouselItem
                    key={feature.title}
                    className="pl-4 sm:basis-1/2 xl:basis-1/3"
                  >
                    <Card className="h-full rounded-2l border border-slate-200/80 bg-white/95 shadow-sm transition duration-300 hover:scale-[1.01] hover:border-slate-200/80 hover:shadow-lg hover:ring-2 hover:ring-inset hover:ring-sky-400 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-800 dark:hover:ring-sky-500">
                      <CardContent className="flex h-full min-h-52 flex-col p-6">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {feature.title}
                        </h3>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
            <CarouselPrevious className="left-3 top-[calc(100%+1.25rem)] translate-y-0 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:top-1/2 sm:-left-4 sm:-translate-y-1/2" />
            <CarouselNext className="right-3 top-[calc(100%+1.25rem)] translate-y-0 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:top-1/2 sm:-right-4 sm:-translate-y-1/2" />
          </Carousel>

          <div className="mt-14 flex items-center justify-center gap-3">
            {Array.from({ length: featureGroupCount }).map((_, index) => {
              const isActive = index === activeFeatureGroup

              return (
                <button
                  key={`feature-group-${index}`}
                  type="button"
                  aria-label={`Go to feature cards ${index * 3 + 1} to ${Math.min((index + 1) * 3, featureCards.length)}`}
                  aria-pressed={isActive}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? "w-8 bg-sky-600"
                      : "w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600"
                  }`}
                  onClick={() => carouselApi?.scrollTo(index * 3)}
                />
              )
            })}
          </div>
        </ScrollReveal>
      </section>

      <section
        id="how-it-works"
        ref={howItWorksRef}
        className="scroll-mt-24 bg-white px-4 py-16 dark:bg-[#1d1d1d] sm:px-6 md:py-20 xl:px-8"
      >
        <ScrollReveal>
          <div className="mb-10 text-center md:mb-12">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
              <SplitText
                parts={[
                  { text: "How", className: "text-slate-900 dark:text-slate-50" },
                  { text: " It Works", className: "text-sky-600" },
                ]}
              />
            </h2>
            <ScrollReveal className="mx-auto mt-4 max-w-2xl" delay={120}>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                Follow a simple workflow for setting up projects, tracking progress, and collaborating with your team and adviser.
              </p>
            </ScrollReveal>
          </div>
        </ScrollReveal>

        <div className="mx-auto grid w-full max-w-[92rem] gap-8 text-center md:grid-cols-3">
          {howItWorksSteps.map((step, index) => {
            const Icon = step.icon
            const isVisible = revealedHowItWorksCount > index

            return (
              <div
                key={step.title}
                className="will-change-[transform,opacity,filter]"
                style={{
                  transform: isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 24px, 0)",
                  opacity: isVisible ? 1 : 0,
                  filter: isVisible ? "blur(0px)" : "blur(6px)",
                  transitionProperty: "transform, opacity, filter",
                  transitionDuration: "700ms",
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3
                    className="font-semibold text-slate-900 transition-all duration-700 dark:text-slate-100"
                    style={{
                      transform: isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
                      opacity: isVisible ? 1 : 0,
                      filter: isVisible ? "blur(0px)" : "blur(4px)",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mt-2 text-sm text-gray-600 transition-all duration-700 dark:text-slate-300"
                    style={{
                      transform: isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
                      opacity: isVisible ? 1 : 0,
                      filter: isVisible ? "blur(0px)" : "blur(4px)",
                      transitionDelay: isVisible ? "140ms" : "0ms",
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section id="about" className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-16 text-center sm:px-6 md:py-20">
        <ScrollReveal>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
            <SplitText
              parts={[
                { text: "About", className: "text-slate-900 dark:text-slate-50" },
                { text: " Track", className: "text-slate-900 dark:text-slate-50" },
                { text: "Sphere", className: "text-sky-600" },
              ]}
            />
          </h2>
        </ScrollReveal>
        <ScrollReveal className="mx-auto mt-6 max-w-3xl" delay={40}>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            TrackSphere helps students and advisers keep projects organized, visible, and moving
            with a clearer and more structured workflow.
          </p>
        </ScrollReveal>
        <ScrollReveal className="mx-auto mt-5 max-w-3xl" delay={120}>
          <p className="text-base leading-8 text-slate-500 dark:text-slate-400">
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
            <p>Built for STI College Alabang.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
