"use client"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Users, CheckCircle2, Workflow } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-800">
      <Navbar />

      {/* Hero Section (Left Layout) */}
      <section className="grid md:grid-cols-2 items-center px-6 py-24 max-w-6xl mx-auto gap-10">
        <div className="text-left">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            CapstoneTrack
            <span className="text-blue-600 block">Progress System</span>
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-md">
            A smarter way to manage your research and capstone projects with real-time tracking, collaboration, and structured workflows.
          </p>

          <div className="mt-8 flex gap-4">
            <Button className="rounded-2xl px-6 py-5 text-base">
              Get Started
            </Button>
            <Button variant="outline" className="rounded-2xl px-6 py-5 text-base">
              Learn More
            </Button>
          </div>
        </div>

        {/* Right Side Placeholder */}
        <div className="hidden md:flex items-center justify-center">
          <div className="w-full h-80 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-400">
            Dashboard Preview
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow-sm hover:shadow-md transition">
            <CardContent className="p-6">
              <BarChart3 className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Progress Tracking</h3>
              <p className="text-sm text-gray-600">Track milestones and deadlines easily.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition">
            <CardContent className="p-6">
              <Users className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Collaboration</h3>
              <p className="text-sm text-gray-600">Work with advisers and team members seamlessly.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm hover:shadow-md transition">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Task Management</h3>
              <p className="text-sm text-gray-600">Organize submissions and revisions efficiently.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-20 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto text-center">
          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">1. Create Project</h3>
            <p className="text-sm text-gray-600 mt-2">Start your capstone and define your goals.</p>
          </div>

          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">2. Track Progress</h3>
            <p className="text-sm text-gray-600 mt-2">Update tasks and monitor milestones.</p>
          </div>

          <div>
            <Workflow className="mx-auto mb-4 text-blue-600" />
            <h3 className="font-semibold">3. Collaborate</h3>
            <p className="text-sm text-gray-600 mt-2">Work with advisers and improve your project.</p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">About</h2>
        <p className="text-gray-600">
          CapstoneTrack is designed for students and faculty to simplify research project management. It improves organization, communication, and ensures projects are completed on time.
        </p>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-500">
        © {new Date().getFullYear()} CapstoneTrack
      </footer>
    </main>
  )
}