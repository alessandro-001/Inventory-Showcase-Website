import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/client'
import { Alert } from './Alert'
import { BomList } from './BomList'
import { BomPreview } from './BomPreview'
import { BomTable } from './BomTable'
import { ExportButton } from './ExportButton'
import { useAsync } from '../hooks/useAsync'
import { firstRemaining } from '../lib/bomSelection'

// Admin › Reorder lists (BOMs in code/API). List on the left, selected list on the right; preview + Excel export.
export function ReorderLists({ nav }: { nav: ReactNode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const selected = Number(params.get('bom')) || null
  const list = useAsync(() => api.boms(), [])
  const detail = useAsync(() => (selected ? api.bom(selected) : Promise.resolve(null)), [selected])
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState('')
  const [deleted, setDeleted] = useState<number[]>([])

  // hide lists deleted here even while the list is still reloading (otherwise we'd re-open the one just deleted)
  const boms = (list.data?.boms ?? []).filter(b => !deleted.includes(b.id))

  // open the first remaining list when none is chosen
  const first = firstRemaining(list.data?.boms ?? [], deleted)
  useEffect(() => {
    if (!selected && first) navigate(`/admin?bom=${first}`, { replace: true })
  }, [selected, first, navigate])

  useEffect(() => { setRenaming(false); setError('') }, [selected])

  const refresh = () => { list.reload(); detail.reload() }

  async function create(newName: string) {
    const { id } = await api.createBom(newName)
    list.reload()
    navigate(`/admin?bom=${id}`)
  }

  async function rename(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected) return
    try {
      await api.renameBom(selected, name.trim())
      setRenaming(false)
      refresh()
    } catch (err) { setError((err as Error).message) }
  }

  async function remove() {
    const bom = detail.data?.bom
    if (!bom || !confirm(`Delete "${bom.name}"? Its parts stay in the inventory.`)) return
    try {
      await api.deleteBom(bom.id)
      setDeleted(d => [...d, bom.id])
      list.reload()
      navigate('/admin?tab=lists', { replace: true })
    } catch (err) { setError((err as Error).message) }
  }

  const bom = detail.data?.bom

  return (
    <div className="admin">
      <aside className="admin-side">
        {nav}
        {list.error && <Alert>{list.error}</Alert>}
        <BomList boms={boms} selected={selected} onCreate={create} />
      </aside>

      <section className="admin-main">
        {list.data && !boms.length && (
          <div className="empty"><p>No reorder lists yet. Create one, or add parts from their page.</p></div>
        )}
        {detail.error && <Alert>{detail.error}</Alert>}
        {bom && detail.data && (
          <>
            <div className="bom-head">
              {renaming ? (
                <form className="bom-rename" onSubmit={rename}>
                  <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus aria-label="List name" />
                  <button className="btn btn-primary btn-sm">Save name</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>Cancel</button>
                </form>
              ) : (
                <h2 className="bom-name">{bom.name}</h2>
              )}
              <div className="bom-actions">
                {!renaming && <button type="button" className="btn btn-sm" onClick={() => { setName(bom.name); setRenaming(true) }}>Rename</button>}
                <button type="button" className="btn btn-sm btn-danger" onClick={remove}>Delete list</button>
                <button type="button" className="btn btn-sm" onClick={() => setPreviewOpen(true)}>Preview</button>
                <ExportButton bomId={bom.id} className="btn btn-sm btn-primary" />
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <p className="muted small result-count">
              {detail.data.items.length} part{detail.data.items.length === 1 ? '' : 's'} to order
            </p>
            <div className={detail.loading ? 'is-loading' : ''}><BomTable detail={detail.data} onChanged={refresh} /></div>
            <BomPreview detail={detail.data} open={previewOpen} onClose={() => setPreviewOpen(false)} />
          </>
        )}
      </section>
    </div>
  )
}
