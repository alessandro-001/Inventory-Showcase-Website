import { useState, type ChangeEvent, type DragEvent, type SubmitEvent } from 'react'
import type { BomLine } from '../api/types'
import { readBomFile } from '../lib/bomImport'
import { Alert } from './Alert'

type Picked = { fileName: string; lines: BomLine[]; skipped: { noMpn: number; notFitted: number } }

// Pick an Altium BOM export, read it here in the browser, show what was found, then confirm.
// create: asks for a project name (defaults to the file name); replace: confirms swapping the parts list.
export function BomFilePicker({ mode, label, onConfirm }: {
  mode: 'create' | 'replace'; label: string
  onConfirm: (p: { name: string; fileName: string; lines: BomLine[] }) => Promise<void>
}) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [over, setOver] = useState(false) // a file is being dragged over the drop zone

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires
    if (file) read(file)
  }

  function drop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) read(file)
  }

  async function read(file: File) {
    setError('')
    const r = await readBomFile(file.name, new Uint8Array(await file.arrayBuffer()))
    if (!r.ok) { setPicked(null); setError(r.error); return }
    setPicked({ fileName: file.name, lines: r.lines, skipped: r.skipped })
    setName(file.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  async function confirm(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!picked) return
    setBusy(true)
    setError('')
    try {
      await onConfirm({ name: name.trim(), fileName: picked.fileName, lines: picked.lines })
      setPicked(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const skipped = picked ? picked.skipped.noMpn + picked.skipped.notFitted : 0
  return (
    <div className="bom-pick">
      {!picked && (
        <label className={mode === 'create' ? `bom-drop ${over ? 'over' : ''}` : `btn btn-sm ${over ? 'over' : ''}`}
          onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
          {mode === 'create' ? <><strong>{label}</strong><span className="muted small">or drop the .xlsx / .csv here</span></> : label}
          <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={pick} />
        </label>
      )}
      {error && <Alert>{error}</Alert>}
      {picked && (
        <form className="bom-pick-confirm" onSubmit={confirm}>
          <p className="small">
            <strong>{picked.fileName}</strong><br />
            {picked.lines.length} part{picked.lines.length === 1 ? '' : 's'}
            {skipped > 0 && <span className="muted"> · {skipped} line{skipped === 1 ? '' : 's'} skipped
              ({[picked.skipped.noMpn && `${picked.skipped.noMpn} without part number`,
                picked.skipped.notFitted && `${picked.skipped.notFitted} not fitted`].filter(Boolean).join(', ')})</span>}
          </p>
          {mode === 'create' ? (
            <label className="field">
              <span>Project name</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus />
            </label>
          ) : (
            <p className="small muted">This replaces the project's parts list. Build history stays.</p>
          )}
          <div className="actions">
            <button className="btn btn-primary btn-sm" disabled={busy}>{mode === 'create' ? 'Create project' : 'Replace parts list'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPicked(null); setError('') }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
