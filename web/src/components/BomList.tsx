import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import type { BomSummary } from '../api/types'
import { Alert } from './Alert'

// Reorder lists tab, left column: every list, plus "New list". Selection lives in the URL (?bom=<id>).
export function BomList({ boms, selected, onCreate }:
  { boms: BomSummary[]; selected: number | null; onCreate: (name: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    try {
      await onCreate(name.trim())
      setName('')
      setAdding(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <nav className="bom-list" aria-label="Reorder lists">
      <ul>
        {boms.map(b => (
          <li key={b.id}>
            <Link to={`/admin?bom=${b.id}`} className={`tree-item ${b.id === selected ? 'on' : ''}`}
              aria-current={b.id === selected ? 'page' : undefined}>
              <span>{b.name}</span><span className="chip-count">{b.items}</span>
            </Link>
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="bom-new" onSubmit={submit}>
          <label className="field">
            <span>New list name</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus placeholder="e.g. Reorder November" />
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="actions">
            <button className="btn btn-primary btn-sm">Create</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setError('') }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-block" onClick={() => setAdding(true)}>New list</button>
      )}
    </nav>
  )
}
