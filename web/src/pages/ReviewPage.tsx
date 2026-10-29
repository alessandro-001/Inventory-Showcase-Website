import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import type { PartForm } from '../api/types'
import { AddToBom } from '../components/AddToBom'
import { Alert } from '../components/Alert'
import { CopyButton } from '../components/CopyButton'
import { PartImage } from '../components/PartImage'
import { useAsync } from '../hooks/useAsync'
import { distributorLinks } from '../lib/distributors'
import { packageKind } from '../lib/packageKind'

const EMPTY: PartForm = { mpn: '', manufacturer: '', description: '', folder: '', qty: '1', location: '' }

export function ReviewPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data, error: loadError, loading } = useAsync(() => api.part(id), [id])
  const [form, setForm] = useState<PartForm>(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // e.g. "Added 50 pcs. Now 350 in stock." after a restock from the scan page
  const [notice, setNotice] = useState((useLocation().state as { notice?: string } | null)?.notice ?? '')
  const [savedNow, setSavedNow] = useState(false)

  useEffect(() => {
    if (!data) return
    const { part, folder } = data
    setForm({ mpn: part.mpn, manufacturer: part.manufacturer, description: part.description, folder,
      qty: String(part.qty), location: part.location })
  }, [data])

  if (loadError) return <Alert>{loadError}</Alert>
  if (!data || loading) return <div className="page-loading" aria-busy="true" />

  const { part, paths } = data
  const saved = part.status === 'saved' || savedNow
  const specs = Object.entries(part.attrs ?? {})
  const set = (k: keyof PartForm) => (e: { target: { value: string } }) => {
    setNotice('')
    setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function run(action: () => Promise<unknown>, then = () => navigate('/')) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      then()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  // Save stays on the page (with a confirmation); discard/delete go back since the part is gone.
  const onSave = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    run(() => api.save(id, form), () => {
      setNotice(saved ? 'Changes saved.' : 'Saved to inventory.')
      setSavedNow(true)
    })
  }
  const onDiscard = () => run(() => api.discard(id))
  const onDelete = () => confirm(`Delete ${part.mpn}?`) && run(() => api.remove(id))

  return (
    <div className="review">
      <Link to="/" className="back">Back to inventory</Link>
      <aside className="review-media">
        <PartImage src={part.image_url} label={form.mpn || part.mpn} className="part-img-lg"
          kind={packageKind(form.folder, form.description, form.mpn)} />
        {part.dist_pn && <p className="muted small">Distributor part number: {part.dist_pn}</p>}
        {part.datasheet_url && (
          <div className="link-row">
            <a href={part.datasheet_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Datasheet</a>
          </div>
        )}
        {form.mpn.trim() && (
          <div className="search-on">
            <p className="search-on-title">Search on:</p>
            <div className="search-on-links">
              {distributorLinks(form.mpn).map(l => (
                <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm"
                  title={`Search ${l.name} for this part number (new tab)`}>{l.name}</a>
              ))}
            </div>
          </div>
        )}
        {specs.length > 0 && (
          <table className="specs">
            <tbody>{specs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
          </table>
        )}
      </aside>

      <form className="card review-form" onSubmit={onSave}>
        <h1 className="review-title">{form.mpn || part.mpn}</h1>
        <p className="review-status">{saved ? 'In inventory' : 'New scan, not in the inventory yet'}</p>
        {part.label && <p className="review-label">Scanned from a {part.label} label</p>}
        {part.fuzzy && <Alert>This is the closest match from search. Check it is the right part.</Alert>}
        {part.source === 'manual' && !saved && <Alert kind="info">Fill in what you know. In the full app, part details fill in from DigiKey automatically.</Alert>}

        <div className="field">
          <label htmlFor="mpn">Part number (MPN)</label>
          <div className="input-with-action">
            <input id="mpn" value={form.mpn} onChange={set('mpn')} required maxLength={100} spellCheck={false} />
            <CopyButton text={form.mpn} />
          </div>
        </div>
        <label className="field"><span>Manufacturer</span>
          <input value={form.manufacturer} onChange={set('manufacturer')} maxLength={100} /></label>
        <label className="field"><span>Description</span>
          <input value={form.description} onChange={set('description')} maxLength={500} /></label>
        <label className="field"><span>Folder</span>
          <input value={form.folder} onChange={set('folder')} list="folders" maxLength={250} placeholder="e.g. Capacitors / Ceramic" />
          <datalist id="folders">{paths.map(p => <option key={p} value={p} />)}</datalist></label>
        <div className="field-row">
          <label className="field"><span>Quantity</span>
            <input type="number" inputMode="numeric" min={0} max={10_000_000} required value={form.qty} onChange={set('qty')} /></label>
          <label className="field"><span>Location</span>
            <input value={form.location} onChange={set('location')} list="locations" maxLength={100} placeholder="e.g. Box B3" />
            <datalist id="locations">{(data.locations ?? []).map(l => <option key={l} value={l} />)}</datalist></label>
        </div>

        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <div className="actions">
          <button className="btn btn-primary" disabled={busy}>{saved ? 'Save changes' : 'Save to inventory'}</button>
          {saved
            ? <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete}>Delete part</button>
            : <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDiscard}>Discard scan</button>}
        </div>
      </form>
      {saved && <AddToBom partId={part.id} onBoms={data.boms ?? []} />}
    </div>
  )
}
