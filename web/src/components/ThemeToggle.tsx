import { useTheme, type Theme } from '../hooks/useTheme'

const LABEL: Record<Theme, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }

// Cycles system -> light -> dark. Icons are inline SVG (no icon font, no extra request).
export function ThemeToggle() {
  const { theme, next } = useTheme()
  return (
    <button type="button" className="icon-btn" onClick={next} aria-label={`${LABEL[theme]} (click to change)`} title={LABEL[theme]}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {theme === 'light' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
        {theme === 'dark' && <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />}
        {theme === 'system' && <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>}
      </svg>
    </button>
  )
}
