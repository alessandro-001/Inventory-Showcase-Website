import { useEffect, useState, type MouseEvent } from 'react'

// Copies `text` to the clipboard (needs https or localhost) and briefly confirms.
export function CopyButton({ text, label = 'part number' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 1500)
    return () => clearTimeout(t)
  }, [state])

  async function copy(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation() // don't also open the row/card it sits in
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  const title = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : `Copy ${label}`
  return (
    <button type="button" className={`icon-btn copy-btn ${state}`} onClick={copy} disabled={!text} aria-label={title} title={title}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {state === 'copied'
          ? <path d="M20 6 9 17l-5-5" />
          : <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>}
      </svg>
      <span className="sr-only" aria-live="polite">{state === 'idle' ? '' : title}</span>
    </button>
  )
}
