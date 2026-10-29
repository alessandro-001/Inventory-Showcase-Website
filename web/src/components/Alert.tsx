import type { ReactNode } from 'react'

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info' | 'success'; children: ReactNode }) {
  return <p className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}
