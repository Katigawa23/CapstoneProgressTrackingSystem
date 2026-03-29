"use client"

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  yOffset?: number
  threshold?: number
}

export default function ScrollReveal({
  children,
  className,
  delay = 0,
  yOffset = 24,
  threshold = 0.18,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold])

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
    transform: isVisible ? "translate3d(0, 0, 0)" : `translate3d(0, ${yOffset}px, 0)`,
    opacity: isVisible ? 1 : 0,
    filter: isVisible ? "blur(0px)" : "blur(6px)",
    transitionProperty: "transform, opacity, filter",
    transitionDuration: "700ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "will-change-[transform,opacity,filter] motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:filter-none",
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
