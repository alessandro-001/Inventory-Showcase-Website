import { useNavigate } from 'react-router'
import type { PartSummary } from '../api/types'
import { packageKind } from '../lib/packageKind'
import { CopyButton } from './CopyButton'
import { PartImage } from './PartImage'

// Dense desktop view. Rows open the part (click or Enter).
export function PartTable({ parts }: { parts: PartSummary[] }) {
  const navigate = useNavigate()
  const open = (id: number) => navigate(`/review/${id}`)
  return (
    <div className="table-wrap">
      <table className="parts-table">
        <thead>
          <tr><th aria-label="Image" /><th>Part number</th><th>Manufacturer</th><th>Description</th><th>Folder</th><th className="num">Qty</th><th>Location</th></tr>
        </thead>
        <tbody>
          {parts.map(p => (
            <tr key={p.id} tabIndex={0} onClick={() => open(p.id)} onKeyDown={e => e.key === 'Enter' && open(p.id)}>
              <td className="thumb"><PartImage src={p.image_url} label={p.mpn} kind={packageKind(p.folder, p.description, p.mpn)} /></td>
              <td><span className="mpn-cell"><span className="part-mpn">{p.mpn}</span><CopyButton text={p.mpn} /></span></td>
              <td>{p.manufacturer}</td>
              <td className="desc">{p.description}</td>
              <td className="muted">{p.folder}</td>
              <td className={`num qty ${p.qty === 0 ? 'qty-empty' : ''}`}>{p.qty.toLocaleString()}</td>
              <td>{p.location && <span className="tag">{p.location}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
