import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import { Alert } from '../components/Alert'
import { DraftsStrip } from '../components/DraftsStrip'
import { FolderNav } from '../components/FolderNav'
import { FolderTree } from '../components/FolderTree'
import { PartCard } from '../components/PartCard'
import { PartTable } from '../components/PartTable'
import { useAsync } from '../hooks/useAsync'
import { useStoredState } from '../hooks/useStoredState'

const VIEWS = ['grid', 'list'] as const

export function InventoryPage() {
  const [params, setParams] = useSearchParams()
  const cat = Number(params.get('cat')) || null
  const q = params.get('q') ?? ''
  const [search, setSearch] = useState(q)
  const [view, setView] = useStoredState('inventory-view', 'grid', VIEWS)
  const { data, error, loading, reload } = useAsync(() => api.parts({ cat, q }), [cat, q])

  // keep the box in sync when the URL changes (back button, folder links)
  useEffect(() => setSearch(q), [q])

  // live search: push to the URL 300 ms after typing stops (one request per pause, not per keystroke)
  useEffect(() => {
    const term = search.trim()
    if (term === q) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (term) next.set('q', term)
      else next.delete('q')
      setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [search, q, params, setParams])

  // shortcut: refresh when the tab is shown again instead of polling (picks up changes made in another tab)
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [reload])

  const parts = data?.parts ?? []

  return (
    <div className="inventory">
      <aside className="inventory-side">
        {data && <FolderTree tree={data.tree} current={cat} q={q} total={data.total} />}
      </aside>

      <section className="inventory-main">
        <div className="toolbar">
          <input type="search" className="toolbar-search" placeholder="Search by part number, maker, description or location"
            maxLength={100} value={search} onChange={e => setSearch(e.target.value)} aria-label="Search parts" />
          <div className="segmented" role="group" aria-label="View">
            {VIEWS.map(v => (
              <button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === 'grid' ? 'Cards' : 'List'}
              </button>
            ))}
          </div>
        </div>

        {data && <DraftsStrip drafts={data.drafts} />}
        {data && <FolderNav tree={data.tree} current={cat} q={q} />}
        {error && <Alert>{error}</Alert>}

        {data && (
          <p className="result-count muted small" aria-live="polite">
            {parts.length === 500 ? 'Showing first 500 parts' : `${parts.length} part${parts.length === 1 ? '' : 's'}`}
            {q && <> matching “{q}”</>}
          </p>
        )}

        {parts.length > 0 && (
          <div className={loading ? 'is-loading' : ''}>
            {view === 'grid'
              ? <div className="grid">{parts.map(p => <PartCard key={p.id} part={p} />)}</div>
              : <PartTable parts={parts} />}
          </div>
        )}
        {data && parts.length === 0 && (
          <div className="empty">
            {q
              ? <><p>No parts match “{q}”.</p><button type="button" className="btn" onClick={() => setSearch('')}>Clear search</button></>
              : cat
                ? <><p>This folder is empty.</p><Link to="/scan" className="btn btn-primary">Scan a part</Link></>
                : <><p>No parts yet. Scan a label or type a part number to add your first one.</p>
                    <Link to="/scan" className="btn btn-primary">Scan a part</Link></>}
          </div>
        )}
        {!data && loading && <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="part-card skeleton" />)}</div>}
      </section>

      <Link to="/scan" className="fab" aria-label="Scan a part">Scan</Link>
    </div>
  )
}
