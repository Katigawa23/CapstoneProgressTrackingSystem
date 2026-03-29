"use client"

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type ScrollFloatProps = {
  children: ReactNode
  className?: string
  intensity?: number
}

export default function ScrollFloat({
  children,
  className,
  intensity = 18,
}: ScrollFloatProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let frameId = 0

    const updateOffset = () => {
      frameId = 0

      const element = ref.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const viewportCenter = window.innerHeight / 2
      const elementCenter = rect.top + rect.height / 2
      const distanceFromCenter = (elementCenter - viewportCenter) / window.innerHeight
      const nextOffset = Math.max(-intensity, Math.min(intensity, -distanceFromCenter * intensity * 2))

      setOffset(nextOffset)
    }

    const handleScroll = () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }

      frameId = requestAnimationFrame(updateOffset)
    }

    updateOffset()
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleScroll)

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }

      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
    }
  }, [intensity])

  const style: CSSProperties = {
    transform: `translate3d(0, ${offset}px, 0)`,
    transition: "transform 180ms linear",
  }

  return (
    <div
      ref={ref}
      className={cn("will-change-transform motion-reduce:transform-none", className)}
      style={style}
    >
      {children}
    </div>
  )
}
