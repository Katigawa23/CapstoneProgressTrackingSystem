"use client"

import type { CSSProperties, HTMLAttributes, ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

type AnimatedContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  container?: Element | string | null
  distance?: number
  direction?: "vertical" | "horizontal"
  reverse?: boolean
  duration?: number
  ease?: string
  initialOpacity?: number
  animateOpacity?: boolean
  scale?: number
  threshold?: number
  delay?: number
  disappearAfter?: number
  disappearDuration?: number
  disappearEase?: string
  onComplete?: () => void
  onDisappearanceComplete?: () => void
}

type AnimationPhase = "hidden" | "visible" | "disappearing"

const easeMap: Record<string, string> = {
  "power3.out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "power3.in": "cubic-bezier(0.32, 0, 0.67, 0)",
  "power3.inOut": "cubic-bezier(0.65, 0, 0.35, 1)",
}

function resolveEase(ease: string) {
  return easeMap[ease] ?? ease
}

export default function AnimatedContent({
  children,
  container,
  distance = 100,
  direction = "vertical",
  reverse = false,
  duration = 0.8,
  ease = "power3.out",
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power3.in",
  onComplete,
  onDisappearanceComplete,
  className,
  style,
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<AnimationPhase>("hidden")

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      const reducedMotionTimer = window.setTimeout(() => {
        setPhase("visible")
      }, 0)

      return () => {
        window.clearTimeout(reducedMotionTimer)
      }
    }

    let root: Element | null = null
    if (typeof container === "string") {
      root = document.querySelector(container)
    } else if (container instanceof Element) {
      root = container
    } else {
      root = document.getElementById("snap-main-container")
    }

    let delayTimer: ReturnType<typeof window.setTimeout> | null = null
    let frameOne: number | null = null
    let frameTwo: number | null = null

    const animateIn = () => {
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          delayTimer = window.setTimeout(() => {
            setPhase("visible")
          }, delay * 1000)
        })
      })
    }

    const isAlreadyVisible = () => {
      const rect = el.getBoundingClientRect()

      if (root instanceof Element) {
        const rootRect = root.getBoundingClientRect()
        const visibleHeight = Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top)
        const ratio = visibleHeight / Math.max(rect.height, 1)
        return ratio >= threshold
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
      const ratio = visibleHeight / Math.max(rect.height, 1)
      return ratio >= threshold
    }

    if (isAlreadyVisible()) {
      animateIn()

      return () => {
        if (delayTimer) {
          window.clearTimeout(delayTimer)
        }
        if (frameOne) {
          window.cancelAnimationFrame(frameOne)
        }
        if (frameTwo) {
          window.cancelAnimationFrame(frameTwo)
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        animateIn()
        observer.disconnect()
      },
      {
        root,
        threshold,
      }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (delayTimer) {
        window.clearTimeout(delayTimer)
      }
      if (frameOne) {
        window.cancelAnimationFrame(frameOne)
      }
      if (frameTwo) {
        window.cancelAnimationFrame(frameTwo)
      }
    }
  }, [container, delay, threshold])

  useEffect(() => {
    if (phase !== "visible") {
      return
    }

    const completeTimer = window.setTimeout(() => {
      onComplete?.()
    }, duration * 1000)

    let disappearTimer: ReturnType<typeof window.setTimeout> | null = null
    let disappearDoneTimer: ReturnType<typeof window.setTimeout> | null = null

    if (disappearAfter > 0) {
      disappearTimer = window.setTimeout(() => {
        setPhase("disappearing")

        disappearDoneTimer = window.setTimeout(() => {
          onDisappearanceComplete?.()
        }, disappearDuration * 1000)
      }, (duration + disappearAfter) * 1000)
    }

    return () => {
      window.clearTimeout(completeTimer)
      if (disappearTimer) {
        window.clearTimeout(disappearTimer)
      }
      if (disappearDoneTimer) {
        window.clearTimeout(disappearDoneTimer)
      }
    }
  }, [
    disappearAfter,
    disappearDuration,
    duration,
    onComplete,
    onDisappearanceComplete,
    phase,
  ])

  const animatedStyle = useMemo<CSSProperties>(() => {
    const axis = direction === "horizontal" ? "X" : "Y"
    const offset = reverse ? -distance : distance

    if (phase === "visible") {
      return {
        transform: "translate3d(0, 0, 0) scale(1)",
        opacity: 1,
        visibility: "visible",
        transition: `transform ${duration}s ${resolveEase(ease)}, opacity ${duration}s ${resolveEase(ease)}`,
        willChange: "transform, opacity",
      }
    }

    if (phase === "disappearing") {
      const exitOffset = reverse ? distance : -distance
      return {
        transform:
          axis === "X"
            ? `translate3d(${exitOffset}px, 0, 0) scale(0.8)`
            : `translate3d(0, ${exitOffset}px, 0) scale(0.8)`,
        opacity: animateOpacity ? initialOpacity : 0,
        visibility: "visible",
        transition: `transform ${disappearDuration}s ${resolveEase(disappearEase)}, opacity ${disappearDuration}s ${resolveEase(disappearEase)}`,
        willChange: "transform, opacity",
      }
    }

    return {
      transform:
        axis === "X"
          ? `translate3d(${offset}px, 0, 0) scale(${scale})`
          : `translate3d(0, ${offset}px, 0) scale(${scale})`,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: "visible",
      transition: `transform ${duration}s ${resolveEase(ease)}, opacity ${duration}s ${resolveEase(ease)}`,
      willChange: "transform, opacity",
    }
  }, [
    animateOpacity,
    direction,
    disappearDuration,
    disappearEase,
    distance,
    duration,
    ease,
    initialOpacity,
    phase,
    reverse,
    scale,
  ])

  return (
    <div ref={ref} className={className} style={{ ...animatedStyle, ...style }} {...props}>
      {children}
    </div>
  )
}
