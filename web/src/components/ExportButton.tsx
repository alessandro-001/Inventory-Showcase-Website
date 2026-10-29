import { useState } from 'react'
import { api } from '../api/client'
import { whenSaved } from '../lib/pendingSaves'

// Waits for any quantity edit still saving, then downloads the .xlsx (built in the browser).
export function ExportButton({ bomId, className = 'btn btn-primary' }: { bomId: number; className?: string }) {
  const [busy, setBusy] = useState(false)
  async function exportXlsx() {
    setBusy(true)
    await whenSaved()
    await api.exportBom(bomId).catch(e => alert((e as Error).message))
    setBusy(false)
  }
  return <button type="button" className={className} onClick={exportXlsx} disabled={busy}>Export to Excel</button>
}
