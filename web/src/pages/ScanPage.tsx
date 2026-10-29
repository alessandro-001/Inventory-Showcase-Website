import { useCallback, useRef, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { StockMatch } from '../api/types'
import { Alert } from '../components/Alert'
import { RestockDialog } from '../components/RestockDialog'
import { useBarcodeScanner, type ScannerStatus } from '../hooks/useBarcodeScanner'

const STATUS_TEXT: Record<ScannerStatus, string> = {
  starting: 'Starting camera…',
  scanning: 'Point the camera at the label’s barcode',
  paused: 'Reading…',
  unsupported: 'Camera unavailable here (needs HTTPS). Type the part number below.',
  blocked: 'Camera blocked or unavailable. Allow camera access, or type the part number below.',
}

export function ScanPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manual, setManual] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // part already in stock: ask before adding (camera stays paused while the dialog is open)
  const [found, setFound] = useState<{ barcode: string; match: StockMatch; qty: number | null; camera: boolean } | null>(null)
  const [foundError, setFoundError] = useState('')

  const submit = useCallback(async (barcode: string, camera: boolean, force = false) => {
    setBusy(true)
    setError('')
    try {
      const r = await api.scan(barcode, force)
      if ('match' in r) {
        setFound({ barcode, match: r.match, qty: r.qty, camera })
        setBusy(false)
      } else navigate(`/review/${r.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
      return false
    }
    return true
  }, [navigate])

  const { status, torch, resume } = useBarcodeScanner(videoRef, async text => {
    if (!(await submit(text, true))) resume()
  })

  async function restock(qty: number) {
    if (!found) return
    setBusy(true)
    setFoundError('')
    try {
      const r = await api.restock(found.match.id, qty)
      navigate(`/review/${found.match.id}`, { state: { notice: `Added ${qty.toLocaleString()} pcs. Now ${r.qty.toLocaleString()} in stock.` } })
    } catch (e) {
      setFoundError((e as Error).message)
      setBusy(false)
    }
  }

  function closeFound() {
    const camera = found?.camera
    setFound(null)
    setFoundError('')
    if (camera) resume()
  }

  function onManual(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (manual.trim()) submit(manual.trim(), false)
  }

  return (
    <div className="scan">
      <div className={`viewfinder viewfinder-${status}`}>
        <video ref={videoRef} playsInline muted />
        <div className="viewfinder-frame" aria-hidden="true" />
        {torch && (
          <button type="button" className={`btn btn-sm torch ${torch.on ? 'on' : ''}`} onClick={torch.toggle}>
            {torch.on ? 'Torch off' : 'Torch'}
          </button>
        )}
      </div>
      <p className="scan-status" aria-live="polite">{STATUS_TEXT[status]}</p>
      {error && <Alert>{error}</Alert>}

      <form className="card" onSubmit={onManual}>
        <label className="field">
          <span>…or type the part number</span>
          <input maxLength={2048} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            value={manual} onChange={e => setManual(e.target.value)} placeholder="e.g. GRM188R71C104KA01D" />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy || !manual.trim()}>{busy ? 'Adding…' : 'Add'}</button>
      </form>

      {found && (
        <RestockDialog match={found.match} qty={found.qty} busy={busy} error={foundError || error}
          onRestock={restock} onNew={() => submit(found.barcode, false, true)} onCancel={closeFound} />
      )}
    </div>
  )
}
