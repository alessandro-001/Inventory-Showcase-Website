import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { api } from '../api/client'
import type { BomSummary } from '../api/types'
import { Alert } from './Alert'

const NEW = 'new'
export interface ShortPart { mpn: string; stock: number; need: number }

// "Remove from stock": confirm when everything is covered; otherwise say how many boards the stock allows,
// offer to build those, or to put the shortfall on a reorder list.
export function BuildDialog({ boards, max, pieces, parts, short, busy, error, onBuild, onShortages, onCancel }: {
  boards: number; max: number; pieces: number; parts: number; short: ShortPart[]; busy: boolean; error: string
  onBuild: (boards: number) => void; onShortages: (bomId: number, listName: string) => Promise<void>; onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'main' | 'list'>('main')
  const [lists, setLists] = useState<BomSummary[]>([])
  const [choice, setChoice] = useState('')
  const [newName, setNewName] = useState('')
  const [listError, setListError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { ref.current?.showModal() }, [])

  function openLists() {
    setStep('list')
    api.boms().then(({ boms }) => { setLists(boms); setChoice(c => c || (boms[0] ? String(boms[0].id) : NEW)) }, () => setChoice(NEW))
  }

  async function addShortages(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setListError('')
    try {
      let id = Number(choice)
      let name = lists.find(l => l.id === id)?.name ?? ''
      if (choice === NEW) { name = newName.trim(); id = (await api.createBom(name)).id }
      await onShortages(id, name)
    } catch (err) {
      setListError((err as Error).message)
      setSaving(false)
    }
  }

  const named = short.slice(0, 3).map(s => `${s.mpn} (${s.stock.toLocaleString()} in stock)`).join(', ')
  const more = short.length > 3 ? ` and ${short.length - 3} more` : ''

  return (
    <dialog ref={ref} className="restock build-dialog" onCancel={e => { e.preventDefault(); onCancel() }} aria-labelledby="build-title">
      {step === 'main' && !short.length && (
        <>
          <h2 id="build-title">Remove from stock</h2>
          <p>Take <strong>{pieces.toLocaleString()} pieces</strong> of {parts} part{parts === 1 ? '' : 's'} off stock
            for <strong>{boards.toLocaleString()} board{boards === 1 ? '' : 's'}</strong>?</p>
          {error && <Alert>{error}</Alert>}
          <div className="actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onBuild(boards)}>
              {busy ? 'Removing…' : 'Remove from stock'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {step === 'main' && short.length > 0 && (
        <>
          <h2 id="build-title">Not enough stock for {boards.toLocaleString()} boards</h2>
          <p>{max > 0 ? <>You have enough parts for <strong>{max.toLocaleString()} board{max === 1 ? '' : 's'}</strong>.</>
            : <>There isn't enough stock for a single board.</>} Short: {named}{more}.</p>
          {error && <Alert>{error}</Alert>}
          <div className="actions">
            {max > 0 && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onBuild(max)}>
                {busy ? 'Removing…' : `Remove for ${max.toLocaleString()} board${max === 1 ? '' : 's'}`}
              </button>
            )}
            <button type="button" className="btn" disabled={busy} onClick={openLists}>Add shortages to a reorder list</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {step === 'list' && (
        <form onSubmit={addShortages}>
          <h2 id="build-title">Add shortages to a reorder list</h2>
          <p className="muted small">
            {short.length} part{short.length === 1 ? '' : 's'}, each with what's missing for {boards.toLocaleString()} boards.
            A part already on the list gets this quantity instead.
          </p>
          <label className="field">
            <span>Reorder list</span>
            <select value={choice} onChange={e => setChoice(e.target.value)}>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              <option value={NEW}>New list…</option>
            </select>
          </label>
          {choice === NEW && (
            <label className="field">
              <span>New list name</span>
              <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} required autoFocus placeholder="e.g. Reorder November" />
            </label>
          )}
          {listError && <Alert>{listError}</Alert>}
          <div className="actions">
            <button className="btn btn-primary" disabled={saving || !choice}>{saving ? 'Adding…' : 'Add to list'}</button>
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setStep('main')}>Back</button>
          </div>
        </form>
      )}
    </dialog>
  )
}
