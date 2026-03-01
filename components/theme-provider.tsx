"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import type { Theme } from "@/lib/theme"
import { getInitialTheme, THEME_STORAGE_KEY } from "@/lib/theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export const ThemeProvider = ({
  children,
  defaultTheme,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
}) => {
  const [theme, setThemeState] = useState<Theme>(
    defaultTheme ?? "light"
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const initial = getInitialTheme()
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      applyTheme(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
  }, [mounted, theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return ctx
}
