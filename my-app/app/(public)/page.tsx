"use client"

import { BarChart3, CheckCircle2, Users, Workflow } from "lucide-react"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800">
      <Navbar />

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-24 md:grid-cols-2">
        <div className="text-left">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight md:text-6xl">
            CapstoneTrack
            <span className="block text-blue-600">Progress System</span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-gray-600">
            A smarter way to manage your research and capstone projects with real-time
            tracking, collaboration, and structured workflows.
          </p>

          <div className="mt-8 flex gap-4">
            <Button className="rounded-2xl px-6 py-5 text-base">Get Started</Button>
            <Button variant="outline" className="rounded-2xl px-6 py-5 text-base">
              Learn More
            </Button>
          </div>
        </div>

        <div className="hidden items-center justify-center md:flex">
          <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
            Dashboard Preview
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
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

      <section className="bg-white px-6 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>

        <div className="mx-auto grid max-w-6xl gap-8 text-center md:grid-cols-3">
          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">1. Create Project</h3>
            <p className="mt-2 text-sm text-gray-600">
              Start your capstone and define your goals.
            </p>
          </div>

          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">2. Track Progress</h3>
            <p className="mt-2 text-sm text-gray-600">
              Update tasks and monitor milestones.
            </p>
          </div>

          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">3. Collaborate</h3>
            <p className="mt-2 text-sm text-gray-600">
              Work with advisers and improve your project.
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="mb-6 text-3xl font-bold">About</h2>
        <p className="text-gray-600">
          CapstoneTrack is designed for students and faculty to simplify research
          project management. It improves organization, communication, and ensures
          projects are completed on time.
        </p>
      </section>

      <footer className="py-6 text-center text-sm text-gray-500">
        {"(c)"} {new Date().getFullYear()} CapstoneTrack
      </footer>
    </main>
  )
}
