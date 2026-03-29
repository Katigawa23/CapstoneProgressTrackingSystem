"use client"

import { type CSSProperties, useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type SplitTextPart = {
  text: string
  className?: string
}

type SplitTextProps = {
  parts: SplitTextPart[]
  className?: string
  delayStep?: number
  initialDelay?: number
}

export default function SplitText({
  parts,
  className,
  delayStep = 45,
  initialDelay = 80,
}: SplitTextProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  let characterIndex = 0

  return (
    <span className={cn("inline-block", className)} aria-label={parts.map((part) => part.text).join("")}>
      {parts.map((part, partIndex) => (
        <span key={`${part.text}-${partIndex}`} className={cn("inline-block", part.className)}>
          {Array.from(part.text).map((character, charIndex) => {
            const style: CSSProperties = {
              transitionDelay: `${initialDelay + characterIndex * delayStep}ms`,
              transform: isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 36px, 0)",
              opacity: isVisible ? 1 : 0,
              filter: isVisible ? "blur(0px)" : "blur(8px)",
              transitionProperty: "transform, opacity, filter",
              transitionDuration: "700ms",
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }

            characterIndex += 1

            return (
              <span
                key={`${part.text}-${charIndex}`}
                aria-hidden="true"
                className="inline-block whitespace-pre will-change-[transform,opacity,filter] motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:filter-none"
                style={style}
              >
                {character}
              </span>
            )
          })}
        </span>
      ))}
    </span>
  )
}
