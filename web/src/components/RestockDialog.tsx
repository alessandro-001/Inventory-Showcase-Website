import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { StockMatch } from '../api/types'
import { Alert } from './Alert'

// Scanned a part that's already stocked (a reorder arrived): add the label's quantity to it,
// or save the scan as a separate new entry.
export function RestockDialog({ match, qty: labelQty, busy, error, onRestock, onNew, onCancel }: {
  match: StockMatch; qty: number | null; busy: boolean; error: string
  onRestock: (qty: number) => void; onNew: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [qty, setQty] = useState(labelQty ? String(labelQty) : '') // no quantity on the label: the user types it
  useEffect(() => { ref.current?.showModal() }, [])

  const n = Number(qty)
  const valid = Number.isInteger(n) && n >= 1 && n <= 10_000_000
  const submit = (e: SubmitEvent<HTMLFormElement>) => { e.preventDefault(); if (valid) onRestock(n) }

  return (
    <dialog ref={ref} className="restock" onCancel={e => { e.preventDefault(); onCancel() }} aria-labelledby="restock-title">
      <form onSubmit={submit}>
        <h2 id="restock-title">Already in inventory</h2>
        <p className="restock-part">
          <span className="part-mpn">{match.mpn}</span>
          {match.manufacturer && <span className="muted"> · {match.manufacturer}</span>}
        </p>
        <p className="muted small">
          {match.qty === 0 ? 'Out of stock' : `${match.qty.toLocaleString()} pcs in stock`}
          {match.location && ` · ${match.location}`}
        </p>
        <label className="field">
          <span>Pieces to add</span>
          <input type="number" inputMode="numeric" min={1} max={10_000_000} step={1} required autoFocus
            value={qty} onChange={e => setQty(e.target.value)} placeholder="How many arrived?" />
        </label>
        <p className="muted small">
          {labelQty ? `From the label: ${labelQty.toLocaleString()} pcs. Change it if the pack differs.`
            : 'The label doesn’t say how many pieces. Count them and enter the number.'}
        </p>
        {valid && <p className="muted small">New total: {(match.qty + n).toLocaleString()} pcs</p>}
        {error && <Alert>{error}</Alert>}
        <div className="actions">
          <button className="btn btn-primary" disabled={busy || !valid}>Add to stock</button>
          <button type="button" className="btn" disabled={busy} onClick={onNew}>Save as new entry</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </dialog>
  )
}
