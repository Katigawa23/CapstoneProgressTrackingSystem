"use client"

import { useRouter } from "next/navigation"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import type { UserRole } from "@/lib/rbac"

const ROLE_STORAGE_KEY = "dashboard-role"

export default function LandingPage() {
  const router = useRouter()

  const enterDashboard = (role: UserRole) => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, role)
    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-32 px-6">
        

        <div className="mt-8 flex w-full sm:max-w-md flex-col gap-3 sm:flex-row">
          <Button className="flex-1" onClick={() => enterDashboard("student")}>
            Student Dashboard
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => enterDashboard("adviser")}>
            Adviser Dashboard
          </Button>
        </div>
      </section>
    </main>
  )
}
