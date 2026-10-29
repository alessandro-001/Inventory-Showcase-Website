import { useEffect } from 'react'
import { useStoredState } from './useStoredState'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
const KEY = 'theme'

// <html data-theme> forces light/dark; no attribute = follow the OS (CSS light-dark() + color-scheme do the rest).
export function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

// Called once before React renders, so a stored choice applies without a flash of the other theme.
export function applyStoredTheme() {
  try {
    const t = localStorage.getItem(KEY) as Theme | null
    if (t && THEMES.includes(t)) applyTheme(t)
  } catch { /* storage blocked: follow the OS */ }
}

export function useTheme() {
  const [theme, setTheme] = useStoredState<Theme>(KEY, 'system', THEMES)
  useEffect(() => applyTheme(theme), [theme])
  const next = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])
  return { theme, next }
}
