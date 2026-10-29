import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { BomSummary, PartDetail } from '../api/types'
import { Alert } from './Alert'

const NEW = 'new'

// "Add to reorder list" box on a saved part's page: pick a reorder list (BOM in code) or create one, and the quantity to order.
export function AddToBom({ partId, onBoms }: { partId: number; onBoms: PartDetail['boms'] }) {
  const [boms, setBoms] = useState<BomSummary[]>([])
  const [on, setOn] = useState(onBoms)
  const [choice, setChoice] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string; bomId?: number } | null>(null)

  useEffect(() => {
    api.boms().then(({ boms }) => {
      setBoms(boms)
      setChoice(c => c || (boms[0] ? String(boms[0].id) : NEW))
    }, () => setChoice(NEW))
  }, [])

  const existing = on.find(b => String(b.id) === choice)

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = Number(qty)
    setBusy(true)
    setMsg(null)
    try {
      let bomId = Number(choice)
      let name = boms.find(b => b.id === bomId)?.name ?? ''
      if (choice === NEW) {
        name = newName.trim()
        bomId = (await api.createBom(name)).id
        setBoms(bs => [...bs, { id: bomId, name, items: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
        setChoice(String(bomId))
        setNewName('')
      }
      await api.addToBom(bomId, partId, n)
      setOn(list => [...list.filter(b => b.id !== bomId), { id: bomId, name, qty: n }])
      setMsg({ kind: 'success', text: `Added to ${name}: ${n.toLocaleString()} pcs.`, bomId })
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card bom-add" onSubmit={submit}>
      <h2>Add to reorder list</h2>
      {existing && (
        <p className="muted small">Already on {existing.name} ({existing.qty.toLocaleString()} pcs). Adding again replaces the quantity.</p>
      )}
      <div className="bom-add-row">
        <label className="field">
          <span>Reorder list</span>
          <select value={choice} onChange={e => setChoice(e.target.value)}>
            {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value={NEW}>New list…</option>
          </select>
        </label>
        {choice === NEW && (
          <label className="field">
            <span>New list name</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} required placeholder="e.g. Reorder November" />
          </label>
        )}
        <label className="field bom-add-qty">
          <span>Quantity to order</span>
          <input type="number" inputMode="numeric" min={1} max={10_000_000} step={1} required value={qty} onChange={e => setQty(e.target.value)} />
        </label>
      </div>
      {msg && (
        <Alert kind={msg.kind}>
          {msg.text} {msg.bomId && <Link to={`/admin?bom=${msg.bomId}`}>Open list</Link>}
        </Alert>
      )}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add to reorder list'}</button>
    </form>
  )
}
