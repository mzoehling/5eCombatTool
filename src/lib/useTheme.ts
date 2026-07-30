import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const THEME_KEY = '5ect-theme'

/**
 * Light (warm vellum) is the default; only an explicitly stored 'dark' opts out.
 *
 * Shared by the DM app and the Player View: a player's phone at a dark table
 * wants the candlelit palette just as much as the DM's iPad does, and the
 * viewer is a separate root, so it cannot inherit the DM's choice.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
