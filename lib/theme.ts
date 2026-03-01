export const THEME_STORAGE_KEY = "attendance-theme"

export type Theme = "light" | "dark"

export const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === "light" || stored === "dark") return stored
  return null
}

export const getSystemTheme = (): Theme =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"

export const getInitialTheme = (): Theme =>
  getStoredTheme() ?? getSystemTheme()
