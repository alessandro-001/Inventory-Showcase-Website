import { Link } from 'react-router'
import type { Draft } from '../api/types'

// Scanned parts not yet reviewed. They stay out of the inventory until saved.
export function DraftsStrip({ drafts }: { drafts: Draft[] }) {
  if (!drafts.length) return null
  return (
    <section className="drafts" aria-label="Waiting for review">
      <h2>Waiting for review <span className="badge">{drafts.length}</span></h2>
      <div className="drafts-row">
        {drafts.map(d => (
          <Link key={d.id} to={`/review/${d.id}`} className="draft">
            <span className="part-mpn">{d.mpn}</span>
            {d.manufacturer && <span className="part-mfr">{d.manufacturer}</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}
