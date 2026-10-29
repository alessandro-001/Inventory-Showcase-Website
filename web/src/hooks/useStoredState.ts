import { useState } from 'react'

// useState that remembers its value in localStorage (per browser). Falls back silently if storage is blocked.
export function useStoredState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key) as T | null
      return v && allowed.includes(v) ? v : initial
    } catch { return initial }
  })
  const set = (v: T) => {
    setValue(v)
    try { localStorage.setItem(key, v) } catch { /* private mode */ }
  }
  return [value, set] as const
}
