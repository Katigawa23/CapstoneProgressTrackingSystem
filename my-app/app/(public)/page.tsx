"use client"

import Link from "next/link"
import { BarChart3, CheckCircle2, FolderPlus, MessagesSquare, Users } from "lucide-react"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LandingPage() {
  const openLoginDialog = () => {
    window.dispatchEvent(new Event("open-login-dialog"))
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800">
      <Navbar />

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div className="text-left">
          <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight md:text-6xl">
            <span className="text-slate-950">Track</span>
            <span className="text-sky-600">Sphere</span>
            <span className="block text-2xl text-slate-600 md:text-3xl">Capstone Progress System</span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-gray-600">
            A smarter way to manage your research and capstone projects with real-time
            tracking, collaboration, and structured workflows.
          </p>

          <div className="mt-8 flex gap-4">
            <Button className="rounded-2xl px-6 py-5 text-base" onClick={openLoginDialog}>
              Get Started
            </Button>
            <Button asChild variant="outline" className="rounded-2xl px-6 py-5 text-base">
              <Link href="/#features">Learn More</Link>
            </Button>
          </div>
        </div>

        <div className="hidden items-center justify-center md:flex">
          <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
            Dashboard Preview
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">Features</h2>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
            <CardContent className="p-6">
              <BarChart3 className="mb-4 h-8 w-8 text-blue-600" />
              <h3 className="mb-2 text-lg font-semibold">Progress Tracking</h3>
              <p className="text-sm text-gray-600">Track milestones and deadlines easily.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
            <CardContent className="p-6">
              <Users className="mb-4 h-8 w-8 text-blue-600" />
              <h3 className="mb-2 text-lg font-semibold">Collaboration</h3>
              <p className="text-sm text-gray-600">
                Work with advisers and team members seamlessly.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm transition hover:shadow-md">
            <CardContent className="p-6">
              <CheckCircle2 className="mb-4 h-8 w-8 text-blue-600" />
              <h3 className="mb-2 text-lg font-semibold">Task Management</h3>
              <p className="text-sm text-gray-600">
                Organize submissions and revisions efficiently.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-white px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>

        <div className="mx-auto grid max-w-6xl gap-8 text-center md:grid-cols-3">
          <div>
            <FolderPlus className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">1. Create Project</h3>
            <p className="mt-2 text-sm text-gray-600">
              Start your capstone and define your goals.
            </p>
          </div>

          <div>
            <BarChart3 className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">2. Track Progress</h3>
            <p className="mt-2 text-sm text-gray-600">
              Update tasks and monitor milestones.
            </p>
          </div>

          <div>
            <MessagesSquare className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">3. Collaborate</h3>
            <p className="mt-2 text-sm text-gray-600">
              Work with advisers and improve your project.
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-4xl scroll-mt-24 px-6 py-20 text-center">
        <h2 className="mb-6 text-3xl font-bold">About</h2>
        <p className="mx-auto max-w-2xl text-gray-600">
          TrackSphere helps students and advisers keep projects organized, visible, and moving
          with a clearer and more structured workflow.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500">
          It brings tasks, milestones, updates, and collaboration into one simple workspace.
          With a clearer view of progress, teams stay focused while advisers can guide each
          project more smoothly.
        </p>
      </section>

      <footer
        id="site-footer"
        className="mt-10 border-t border-blue-100 bg-white/75 text-slate-700 backdrop-blur"
      >
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-7 md:grid-cols-[1.2fr_0.8fr]">
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
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
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
