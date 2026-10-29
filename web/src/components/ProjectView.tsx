import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import type { BomLine, ProjectDetail } from '../api/types'
import { MAX_BOARDS, byPart, lossTenths, maxBoards, needFor } from '../lib/buildMath'
import { DEFAULT_LOSS_PCT } from '../lib/constants'
import { Alert } from './Alert'
import { BomFilePicker } from './BomFilePicker'
import { BuildDialog } from './BuildDialog'

// retry-safe id for one "Remove from stock" (getRandomValues also works on plain-http LAN addresses, randomUUID doesn't)
const newRequestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')

// One project: boards + loss in, what each part needs and what's left out; Remove from stock; build history.
export function ProjectView({ detail, onChanged, onDelete }: { detail: ProjectDetail; onChanged: () => void; onDelete: () => void }) {
  const { project, lines, builds } = detail
  const [boards, setBoards] = useState('1')
  const [loss, setLoss] = useState(String(project.loss_pct ?? DEFAULT_LOSS_PCT))
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<{ text: string; listId?: number } | null>(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<{ requestId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  // ---- the numbers (same math as the server, web/src/lib/buildMath.ts) ----
  const n = Number(boards)
  const tenths = lossTenths(loss.trim() === '' ? NaN : Number(loss))
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_BOARDS && tenths !== null
  const t = tenths ?? 0
  const missing = lines.filter(l => !l.part).length
  const stockOf = new Map(lines.flatMap(l => (l.part ? [[l.part.id, l.part.qty] as const] : [])))
  const mpnOf = new Map(lines.flatMap(l => (l.part ? [[l.part.id, l.mpn] as const] : [])))
  const parts = byPart(lines.flatMap(l => (l.part ? [{ partId: l.part.id, perBoard: l.qty_per_board }] : [])))
    .map(p => ({ ...p, stock: stockOf.get(p.partId) ?? 0, need: needFor(p.perBoard, valid ? n : 0, t) }))
  const needOf = new Map(parts.map(p => [p.partId, p.need]))
  const short = parts.filter(p => p.need > p.stock).map(p => ({ mpn: mpnOf.get(p.partId) ?? '', stock: p.stock, need: p.need }))
  const max = maxBoards(parts, t)
  const pieces = parts.reduce((s, p) => s + p.need, 0)
  const canBuild = valid && lines.length > 0 && missing === 0

  async function build(count: number) {
    if (!dialog) return
    setBusy(true)
    setDialogError('')
    try {
      await api.build(project.id, count, Number(loss), dialog.requestId)
      setDialog(null)
      if (count !== n) setBoards(String(count))
      setNotice({ text: `Removed stock for ${count.toLocaleString()} board${count === 1 ? '' : 's'}.` })
      onChanged()
    } catch (e) {
      setDialogError((e as Error).message)
      onChanged() // stock changed meanwhile: the dialog re-renders with fresh numbers
    } finally {
      setBusy(false)
    }
  }

  async function shortages(bomId: number, listName: string) {
    const r = await api.shortagesToList(project.id, n, Number(loss), bomId)
    setDialog(null)
    setNotice({ text: `Added ${r.added} part${r.added === 1 ? '' : 's'} to "${listName}".`, listId: bomId })
  }

  async function undo(buildId: number, count: number, pcs: number) {
    if (!confirm(`Undo this build of ${count} boards? ${pcs.toLocaleString()} pieces go back into stock.`)) return
    setError('')
    try {
      await api.undoBuild(project.id, buildId)
      setNotice({ text: `Build undone. ${pcs.toLocaleString()} pieces are back in stock.` })
      onChanged()
    } catch (e) { setError((e as Error).message) }
  }

  async function rename(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await api.renameProject(project.id, name.trim())
      setRenaming(false)
      onChanged()
    } catch (err) { setError((err as Error).message) }
  }

  async function replace({ fileName, lines: newLines }: { fileName: string; lines: BomLine[] }) {
    await api.replaceLines(project.id, fileName, newLines)
    setNotice({ text: `Parts list replaced from ${fileName}.` })
    onChanged()
  }

  const counts = [
    [lines.length - missing - short.length, 'in stock', ''],
    [short.length, 'short', 'bad'],
    [missing, 'not in inventory', 'warn'],
  ] as const

  return (
    <>
      <div className="bom-head">
        {renaming ? (
          <form className="bom-rename" onSubmit={rename}>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus aria-label="Project name" />
            <button className="btn btn-primary btn-sm">Save name</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>Cancel</button>
          </form>
        ) : (
          <h2 className="bom-name">{project.name}</h2>
        )}
        <div className="bom-actions">
          {!renaming && <button type="button" className="btn btn-sm" onClick={() => { setName(project.name); setRenaming(true) }}>Rename</button>}
          <BomFilePicker mode="replace" label="Replace BOM" onConfirm={replace} />
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>Delete project</button>
        </div>
      </div>
      {project.file_name && <p className="muted small project-file">From {project.file_name}</p>}
      {error && <Alert>{error}</Alert>}
      {notice && (
        <Alert kind="success">
          {notice.text} {notice.listId && <Link to={`/admin?bom=${notice.listId}`}>Open list</Link>}
        </Alert>
      )}

      <div className="build-bar">
        <label className="field">
          <span>Boards to assemble</span>
          <input type="number" inputMode="numeric" min={1} max={MAX_BOARDS} step={1} value={boards} onChange={e => setBoards(e.target.value)} />
        </label>
        <label className="field">
          <span>Machine loss %</span>
          <input type="number" inputMode="decimal" min={0} max={50} step={0.1} value={loss} onChange={e => setLoss(e.target.value)} />
        </label>
        <p className="build-counts" aria-live="polite">
          {counts.filter(([c]) => c > 0).map(([c, label, tone]) => <span key={label} className={tone}>{c} {label}</span>)}
        </p>
        <button type="button" className="btn btn-primary" disabled={!canBuild}
          onClick={() => { setDialogError(''); setDialog({ requestId: newRequestId() }) }}>
          Remove from stock
        </button>
      </div>
      {!canBuild && (
        <p className="muted small build-hint">
          {missing > 0 ? 'Add the parts marked "Not in stock" to the inventory first.'
            : !lines.length ? 'This project has no parts.' : 'Enter boards (1–100,000) and a loss of 0–50 %.'}
        </p>
      )}

      <div className="table-wrap">
        <table className="parts-table bom-table project-table">
          <thead>
            <tr>
              <th>Designators</th><th>Part number</th><th>Manufacturer</th>
              <th className="num">Per board</th><th className="num">Needed</th><th className="num">In stock</th><th className="num">After build</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const need = needFor(l.qty_per_board, valid ? n : 0, t)
              const left = l.part ? l.part.qty - (needOf.get(l.part.id) ?? 0) : 0
              return (
                <tr key={l.mpn} className={!l.part ? 'row-missing' : left < 0 ? 'row-short' : ''}>
                  <td className="designators">{l.designators}</td>
                  <td>{l.part ? <Link to={`/review/${l.part.id}`} className="part-mpn">{l.mpn}</Link> : <span className="part-mpn">{l.mpn}</span>}</td>
                  <td>{l.manufacturer}</td>
                  <td className="num">{l.qty_per_board.toLocaleString()}</td>
                  <td className="num">{need.toLocaleString()}</td>
                  {l.part ? (
                    <>
                      <td className="num">{l.part.qty.toLocaleString()}</td>
                      <td className="num after">{left < 0 ? `short by ${(-left).toLocaleString()}` : left.toLocaleString()}</td>
                    </>
                  ) : (
                    <td colSpan={2} className="missing">Not in stock — please add before proceeding. <Link to="/scan">Add</Link></td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="build-history">
        <h3>Build history</h3>
        {!builds.length ? <p className="muted small">No builds yet.</p> : (
          <ul>
            {builds.map((b, i) => (
              <li key={b.id}>
                <span>{new Date(b.created_at).toLocaleDateString()}</span>
                <span><strong>{b.boards.toLocaleString()}</strong> board{b.boards === 1 ? '' : 's'}</span>
                <span className="muted">loss {b.loss_pct}%</span>
                <span className="muted">{b.pieces.toLocaleString()} pcs</span>
                {i === 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => undo(b.id, b.boards, b.pieces)}>Undo</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <BuildDialog boards={n} max={max} pieces={pieces} parts={parts.length} short={short} busy={busy} error={dialogError}
          onBuild={build} onShortages={shortages} onCancel={() => setDialog(null)} />
      )}
    </>
  )
}
