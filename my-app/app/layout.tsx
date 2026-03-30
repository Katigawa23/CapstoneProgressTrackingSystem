import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TrackSphere",
  description: "TrackSphere helps students and advisers manage capstone milestones, collaboration, and project progress in one place.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
