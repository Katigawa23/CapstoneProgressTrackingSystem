"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Switch } from "@/components/ui/switch"

const THEME_STORAGE_KEY = "theme-preference"

function getPreferredTheme() {
  if (typeof window === "undefined") {
    return false
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === "dark") {
    return true
  }

  if (storedTheme === "light") {
    return false
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark)
  document.documentElement.style.colorScheme = isDark ? "dark" : "light"
  window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light")
}

type ThemeSwitchProps = {
  compact?: boolean
}

export function ThemeSwitch({ compact = false }: ThemeSwitchProps) {
  const [mounted, setMounted] = React.useState(false)
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const nextIsDark = getPreferredTheme()
    setIsDark(nextIsDark)
    setMounted(true)

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleThemeChange = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem(THEME_STORAGE_KEY)) {
        return
      }

      setIsDark(event.matches)
      document.documentElement.classList.toggle("dark", event.matches)
      document.documentElement.style.colorScheme = event.matches ? "dark" : "light"
    }

    mediaQuery.addEventListener("change", handleThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange)
    }
  }, [])

  const handleCheckedChange = React.useCallback((checked: boolean) => {
    setIsDark(checked)
    applyTheme(checked)
  }, [])

  if (!mounted) {
    return (
      <div
        className={
          compact
            ? "h-5 w-9 rounded-full bg-muted/70"
            : "h-9 w-[72px] rounded-full bg-muted/70"
        }
      />
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
        <Switch
          checked={isDark}
          onCheckedChange={handleCheckedChange}
          aria-label="Toggle dark mode"
        />
        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 shadow-xs backdrop-blur">
      <Sun className="h-4 w-4 text-amber-500" />
      <Switch
        checked={isDark}
        onCheckedChange={handleCheckedChange}
        aria-label="Toggle dark mode"
      />
      <Moon className="h-4 w-4 text-sky-500" />
    </div>
  )
}
