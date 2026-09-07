"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react"

export type KamaraTheme = "light" | "dark"

const THEME_STORAGE_KEY = "kamara-theme"

interface ThemeContextValue {
  theme: KamaraTheme

  setTheme: (theme: KamaraTheme) => void

  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: KamaraTheme) {
  const root = document.documentElement

  root.classList.toggle("dark", theme === "dark")

  root.dataset.theme = theme

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  )

  if (themeColor) {
    themeColor.content = theme === "dark" ? "#020617" : "#047857"
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<KamaraTheme>("light")

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

    const initialTheme: KamaraTheme = stored === "dark" ? "dark" : "light"

    setThemeState(initialTheme)

    applyTheme(initialTheme)
  }, [])

  const setTheme = useCallback((nextTheme: KamaraTheme) => {
    setThemeState(nextTheme)

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)

    applyTheme(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const value = useMemo(
    () => ({
      theme,

      setTheme,

      toggleTheme
    }),
    [theme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme deve ser utilizado dentro de ThemeProvider.")
  }

  return context
}
