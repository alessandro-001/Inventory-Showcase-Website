import { useEffect, useRef } from 'react'
import type { BomDetail } from '../api/types'
import { ExportButton } from './ExportButton'

// Read-only view of exactly what the Excel file will contain (same columns, same order as bomXlsx in web/src/demo/store.ts).
export function BomPreview({ detail, open, onClose }: { detail: BomDetail; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} className="bom-preview" onClose={onClose} aria-labelledby="bom-preview-title">
      <div className="bom-preview-head">
        <h2 id="bom-preview-title">Preview: {detail.bom.name}</h2>
        <p className="muted small">This is what the Excel file will contain.</p>
      </div>
      <div className="table-wrap">
        <table className="parts-table">
          <thead>
            <tr>
              <th className="num">Quantity to order</th><th>Manufacturer part number</th><th>Manufacturer</th><th>Description</th>
              <th className="num">In stock</th><th>Location</th><th>DigiKey</th><th>LCSC</th><th>Mouser</th><th>Datasheet</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map(it => (
              <tr key={it.part_id}>
                <td className="num">{it.qty.toLocaleString()}</td><td className="part-mpn">{it.mpn}</td><td>{it.manufacturer}</td>
                <td className="desc">{it.description}</td><td className="num">{it.stock.toLocaleString()}</td><td>{it.location}</td>
                <td>{it.digikey && 'DigiKey'}</td><td>{it.lcsc && 'LCSC'}</td><td>{it.mouser && 'Mouser'}</td><td>{it.datasheet_url && 'Datasheet'}</td>
              </tr>
            ))}
            {!detail.items.length && <tr><td colSpan={10} className="muted">No rows. The file will only have the header.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <ExportButton bomId={detail.bom.id} />
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </dialog>
  )
}
