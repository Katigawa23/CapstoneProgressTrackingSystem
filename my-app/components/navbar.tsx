"use client"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Users, CheckCircle2, Sparkles } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* HERO - Premium SaaS Style */}
      <section className="grid md:grid-cols-2 items-center px-6 py-28 max-w-7xl mx-auto gap-16">
        <div>
          <span className="inline-flex items-center gap-2 text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full mb-4">
            <Sparkles className="w-4 h-4" /> Smart Capstone System
          </span>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Manage Your
            <span className="block text-blue-600">Capstone Smarter</span>
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-lg">
            A modern platform designed for students and advisers to track progress, manage tasks, and collaborate efficiently.
          </p>

          <div className="mt-8 flex gap-4">
            <Button className="rounded-2xl px-6 py-5 text-base shadow-md">
              Get Started
            </Button>
            <Button variant="outline" className="rounded-2xl px-6 py-5 text-base">
              View Demo
            </Button>
          </div>
        </div>

        {/* Dashboard Mock */}
        <div className="relative">
          <div className="absolute inset-0 bg-blue-100 blur-3xl opacity-40 rounded-full"></div>
          <div className="relative bg-white border rounded-2xl shadow-xl p-6">
            <div className="h-4 w-1/3 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-gray-600 mb-12">Everything you need to manage your research workflow.</p>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="rounded-2xl border hover:shadow-lg transition">
              <CardContent className="p-6">
                <BarChart3 className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Real-time Tracking</h3>
                <p className="text-sm text-gray-600">Stay updated with your capstone progress instantly.</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border hover:shadow-lg transition">
              <CardContent className="p-6">
                <Users className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Team Collaboration</h3>
                <p className="text-sm text-gray-600">Communicate with advisers and teammates easily.</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border hover:shadow-lg transition">
              <CardContent className="p-6">
                <CheckCircle2 className="w-8 h-8 text-blue-600 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Task Workflow</h3>
                <p className="text-sm text-gray-600">Organize tasks, submissions, and revisions clearly.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-10 text-center">
          <div>
            <div className="text-4xl font-bold text-blue-600 mb-3">01</div>
            <h3 className="font-semibold mb-2">Create Project</h3>
            <p className="text-gray-600 text-sm">Set up your capstone and define objectives.</p>
          </div>

          <div>
            <div className="text-4xl font-bold text-blue-600 mb-3">02</div>
            <h3 className="font-semibold mb-2">Track Progress</h3>
            <p className="text-gray-600 text-sm">Update milestones and monitor tasks.</p>
          </div>

          <div>
            <div className="text-4xl font-bold text-blue-600 mb-3">03</div>
            <h3 className="font-semibold mb-2">Collaborate</h3>
            <p className="text-gray-600 text-sm">Work with advisers and improve outcomes.</p>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="px-6 py-24 bg-gray-50 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">About CapstoneTrack</h2>
          <p className="text-gray-600">
            Built for academic institutions, CapstoneTrack simplifies project tracking, enhances communication, and ensures timely completion of research and capstone projects.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Start Your Project Today</h2>
        <p className="text-gray-600 mb-8">Join students and advisers using a smarter workflow.</p>
        <Button className="rounded-2xl px-8 py-6 text-base shadow-md">
          Get Started
        </Button>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-8 text-sm text-gray-500 border-t">
        © {new Date().getFullYear()} CapstoneTrack. All rights reserved.
      </footer>
    </main>
  )
}