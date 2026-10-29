import { Link } from 'react-router'
import type { PartSummary } from '../api/types'
import { packageKind } from '../lib/packageKind'
import { PartImage } from './PartImage'

const SPEC_KEYS = ['Capacitance', 'Resistance', 'Inductance', 'Tolerance', 'Voltage - Rated', 'Package / Case']
const keySpecs = (a: Record<string, string>) => SPEC_KEYS.filter(k => a?.[k]).slice(0, 3).map(k => a[k])

export function PartCard({ part }: { part: PartSummary }) {
  const specs = keySpecs(part.attrs)
  return (
    <Link to={`/review/${part.id}`} className="part-card">
      <PartImage src={part.image_url} label={part.mpn} kind={packageKind(part.folder, part.description, part.mpn)} />
      <div className="part-card-body">
        <div className="part-mpn" title={part.mpn}>{part.mpn}</div>
        {part.manufacturer && <div className="part-mfr">{part.manufacturer}</div>}
        {specs.length > 0
          ? <div className="specs-inline">{specs.map(s => <span key={s} className="tag">{s}</span>)}</div>
          : part.description && <div className="part-desc">{part.description}</div>}
        <div className="part-meta">
          <span className={`qty ${part.qty === 0 ? 'qty-empty' : ''}`}>
            {part.qty === 0 ? 'Out of stock' : <>{part.qty.toLocaleString()}<small>pcs</small></>}
          </span>
          {part.location && <span className="tag tag-location">{part.location}</span>}
        </div>
      </div>
    </Link>
  )
}
