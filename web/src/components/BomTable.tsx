import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { BomDetail, BomItem } from '../api/types'
import { trackSave } from '../lib/pendingSaves'
import { CopyButton } from './CopyButton'

// Editable reorder list: order quantity saves on blur/Enter; rows can be removed.
export function BomTable({ detail, onChanged }: { detail: BomDetail; onChanged: () => void }) {
  if (!detail.items.length) {
    return <div className="empty"><p>This list is empty. Open a part and use Add to reorder list.</p><Link to="/" className="btn">Go to inventory</Link></div>
  }
  return (
    <div className="table-wrap">
      <table className="parts-table bom-table">
        <thead>
          <tr>
            <th>Part number</th><th>Manufacturer</th><th>Description</th>
            <th className="num">In stock</th><th>Location</th><th className="num">Order qty</th><th>Links</th><th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {detail.items.map(it => <Row key={it.part_id} bomId={detail.bom.id} item={it} onChanged={onChanged} />)}
        </tbody>
      </table>
    </div>
  )
}

function Row({ bomId, item, onChanged }: { bomId: number; item: BomItem; onChanged: () => void }) {
  const [qty, setQty] = useState(String(item.qty))
  const [error, setError] = useState('')
  useEffect(() => setQty(String(item.qty)), [item.qty])

  async function saveQty() {
    const n = Number(qty)
    if (n === item.qty) return
    setError('')
    try {
      await trackSave(api.setBomQty(bomId, item.part_id, n))
      onChanged()
    } catch (e) {
      setError((e as Error).message)
      setQty(String(item.qty))
    }
  }

  async function remove() {
    await api.removeFromBom(bomId, item.part_id).catch(e => setError((e as Error).message))
    onChanged()
  }

  return (
    <tr className="bom-row">
      <td><span className="mpn-cell"><Link to={`/review/${item.part_id}`} className="part-mpn">{item.mpn}</Link><CopyButton text={item.mpn} /></span></td>
      <td>{item.manufacturer}</td>
      <td className="desc">{item.description}</td>
      <td className={`num qty ${item.stock === 0 ? 'qty-empty' : ''}`}>{item.stock.toLocaleString()}</td>
      <td>{item.location && <span className="tag tag-location">{item.location}</span>}</td>
      <td className="num">
        <input className="qty-input" type="number" inputMode="numeric" min={1} max={10_000_000} step={1}
          aria-label={`Order quantity for ${item.mpn}`} value={qty}
          onChange={e => setQty(e.target.value)} onBlur={saveQty}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        {error && <div className="cell-error" role="alert">{error}</div>}
      </td>
      <td className="links">
        {item.digikey && <a href={item.digikey} target="_blank" rel="noopener noreferrer">DigiKey</a>}
        {item.lcsc && <a href={item.lcsc} target="_blank" rel="noopener noreferrer">LCSC</a>}
        {item.mouser && <a href={item.mouser} target="_blank" rel="noopener noreferrer">Mouser</a>}
        {item.datasheet_url && <a href={item.datasheet_url} target="_blank" rel="noopener noreferrer">Datasheet</a>}
      </td>
      <td>
        <button type="button" className="icon-btn remove-btn" onClick={remove} aria-label={`Remove ${item.mpn}`} title="Remove">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
      </td>
    </tr>
  )
}
