// The demo's "server": the same rules and messages as the real app's API, over one JSON blob in localStorage.
// Every call reads the blob, changes it and writes it back, so two open tabs don't overwrite each other.
// A call that throws writes nothing (all-or-nothing, like a database transaction).
import { ensurePath, seedData } from './seed.ts'
import type { DemoData, StoredPart } from './seed.ts'
import { buildTree, descendantIds, pathOf } from '../lib/tree.ts'
import { parse } from '../lib/parse.ts'
import { safeUrl } from '../lib/url.ts'
import { MAX_BOARDS, byPart, lossTenths, needFor } from '../lib/buildMath.ts'
import { distributorLinks } from '../lib/distributors.ts'
import { buildXlsx } from '../lib/xlsx.ts'
import type { BomDetail, BomLine, BomSummary, Part, PartDetail, PartForm, PartsResponse, ProjectDetail, ProjectSummary, ScanResult } from '../api/types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

// Bump the key when DemoData changes shape, so returning visitors start from the new seed.
export const STORAGE_KEY = 'inventory-demo-v1'
const TABLES = ['categories', 'parts', 'boms', 'bomItems', 'projects', 'projectLines', 'builds', 'buildItems'] as const
const MAX_QTY = 10_000_000
const COLLIDE = 'Could not save (another saved part may have the same MPN and manufacturer).'

const notFound = () => new ApiError('not found', 404)
const isSaved = (p: StoredPart) => p.status === 'saved'
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

const labelOf = (barcode: string) => { try { return parse(barcode).label ?? '' } catch { return '' } }
// URLs are https-only; never send the scanned barcode back (only which label it came from)
const publicPart = ({ barcode, folder_hint, ...p }: StoredPart): Part =>
  ({ ...p, image_url: safeUrl(p.image_url), datasheet_url: safeUrl(p.datasheet_url), fuzzy: false, label: labelOf(barcode) })

// form body -> validated fields, or { error }
function readPartForm(b: Partial<Record<keyof PartForm, unknown>>) {
  const s = (k: keyof PartForm, max: number) => (typeof b[k] === 'string' ? b[k].trim().slice(0, max) : '')
  const qty = parseInt(String(b.qty ?? '').slice(0, 12), 10)
  const folder = s('folder', 250).split('/').map(x => x.trim()).filter(Boolean)
  if (!s('mpn', 100)) return { error: 'Part number is required.' }
  if (!(qty >= 0 && qty <= MAX_QTY)) return { error: 'Quantity must be 0 – 10,000,000.' }
  if (folder.length > 4 || folder.some(x => x.length > 60)) return { error: 'Folder: max 4 levels, 60 characters each.' }
  return { mpn: s('mpn', 100), manufacturer: s('manufacturer', 100), description: s('description', 500),
    location: s('location', 100), qty, folder }
}

// Folders exist only to hold parts: drop every folder with no part in it or below it.
function pruneFolders(d: DemoData) {
  const parent = new Map(d.categories.map(c => [c.id, c.parent_id]))
  const used = new Set<number>()
  for (const p of d.parts) for (let c = p.category_id; c !== null && !used.has(c); c = parent.get(c) ?? null) used.add(c)
  d.categories = d.categories.filter(c => used.has(c.id))
}

// ---------- reorder lists ("BOMs" in code) and projects ----------
const MAX_ROWS = 500
const MAX_LINES = 500
const NAME = 'Name must be 1–80 characters.'
const ORDER_QTY = 'Quantity must be a whole number from 1 to 10,000,000.'
const PER_BOARD = 'Quantity per board must be a whole number from 1 to 100,000.'
const BOM_DUP = 'A reorder list with that name already exists.'
const PROJECT_DUP = 'A project with that name already exists.'
const EXPORT_HEADER = ['Quantity to order', 'Manufacturer part number', 'Manufacturer', 'Description', 'In stock', 'Location', 'DigiKey', 'LCSC', 'Mouser', 'Datasheet']

const listName = (v: unknown) => (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 80 ? v.trim() : null)
const orderQty = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_QTY ? v : null)
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max) : '')

// Lines from the BOM import -> validated, merged by part number.
function readLines(v: unknown): { lines: BomLine[]; error?: undefined } | { error: string } {
  if (!Array.isArray(v) || !v.length || v.length > MAX_LINES) return { error: `Send 1–${MAX_LINES} parts.` }
  const merged = new Map<string, BomLine>()
  for (const l of v) {
    const mpn = clean(l?.mpn, 1000)
    if (!mpn || mpn.length > 100) return { error: 'Every part needs a part number (≤ 100 characters).' }
    if (!(Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= 100_000)) return { error: PER_BOARD }
    const line: BomLine = { mpn, manufacturer: clean(l.manufacturer, 100), supplierPn: clean(l.supplierPn, 100),
      description: clean(l.description, 500), designators: clean(l.designators, 2000), qty: l.qty }
    const had = merged.get(mpn.toUpperCase())
    if (!had) { merged.set(mpn.toUpperCase(), line); continue }
    had.qty += line.qty
    had.designators = [had.designators, line.designators].filter(Boolean).join(', ').slice(0, 2000)
    had.manufacturer ||= line.manufacturer
    had.supplierPn ||= line.supplierPn
    had.description ||= line.description
  }
  const lines = [...merged.values()]
  if (lines.some(l => l.qty > 100_000)) return { error: PER_BOARD }
  return { lines }
}

const toRows = (projectId: number, lines: BomLine[]) => lines.map((l, i) => ({ project_id: projectId, line: i + 1, mpn: l.mpn,
  manufacturer: l.manufacturer, supplier_pn: l.supplierPn, description: l.description, designators: l.designators, qty_per_board: l.qty }))

// Each line with the saved part it matches: same MPN first (preferring the same manufacturer), else the
// distributor part number (same rule as scanning). shortcut: first match only, like scan.
function matchedLines(d: DemoData, projectId: number) {
  const up = (s: string) => s.toUpperCase()
  return d.projectLines.filter(l => l.project_id === projectId).sort((a, b) => a.line - b.line).map(l => {
    const rank = (p: StoredPart) => (up(p.mpn) === up(l.mpn) ? 2 : 0) + (up(p.manufacturer) === up(l.manufacturer) ? 1 : 0)
    const part = d.parts
      .filter(p => isSaved(p) && (up(p.mpn) === up(l.mpn) || (l.supplier_pn !== '' && up(p.dist_pn) === up(l.supplier_pn))))
      .sort((a, b) => rank(b) - rank(a) || a.id - b.id)[0]
    return { line: l, part }
  })
}

const withCounts = (d: DemoData) => d.categories
  .map(c => ({ ...c, n: d.parts.filter(p => isSaved(p) && p.category_id === c.id).length }))
  .sort(byName)

export function createStore(storage: StorageLike | null) {
  // Storage blocked (private mode) or full: keep going in memory for this page.
  let memory: string | null = null
  let memoryOnly = !storage

  function read(): string | null {
    if (!memoryOnly) try { return storage!.getItem(STORAGE_KEY) } catch { memoryOnly = true }
    return memory
  }
  function write(d: DemoData) {
    memory = JSON.stringify(d)
    if (!memoryOnly) try { storage!.setItem(STORAGE_KEY, memory) } catch { memoryOnly = true }
  }
  function load(): DemoData {
    try {
      const d = JSON.parse(read() ?? '')
      if (d && typeof d.nextId === 'number' && TABLES.every(k => Array.isArray(d[k]))) return d
    } catch { /* missing or corrupt: reseed */ }
    return seedData()
  }
  function change<T>(f: (d: DemoData) => T): T {
    const d = load()
    const result = f(d)
    write(d)
    return result
  }
  const savedPart = (d: DemoData, id: number) => {
    const p = d.parts.find(x => x.id === id && isSaved(x))
    if (!p) throw notFound()
    return p
  }
  const findBom = (d: DemoData, id: number) => {
    const b = d.boms.find(x => x.id === id)
    if (!b) throw notFound()
    return b
  }
  const findProject = (d: DemoData, id: number) => {
    const p = d.projects.find(x => x.id === id)
    if (!p) throw notFound()
    return p
  }
  const bomItems = (d: DemoData, bomId: number) => d.bomItems.filter(i => i.bom_id === bomId)
    .map(i => ({ i, p: d.parts.find(p => p.id === i.part_id)! })).filter(x => x.p)
    .sort((a, b) => a.p.mpn.localeCompare(b.p.mpn))
    .map(({ i, p }) => {
      const links = Object.fromEntries(distributorLinks(p.mpn).map(l => [l.name.toLowerCase(), l.url]))
      return { part_id: p.id, qty: i.qty, mpn: p.mpn, manufacturer: p.manufacturer, description: p.description, stock: p.qty,
        location: p.location, datasheet_url: safeUrl(p.datasheet_url), digikey: links.digikey ?? '', lcsc: links.lcsc ?? '', mouser: links.mouser ?? '' }
    })
  // shared by build and shortages: validated input + each matched part's need for that many boards
  function plan(d: DemoData, id: number, boards: unknown, lossPct: unknown) {
    const tenths = lossTenths(lossPct)
    if (!(typeof boards === 'number' && Number.isInteger(boards) && boards >= 1 && boards <= MAX_BOARDS)) throw new ApiError('Boards must be a whole number from 1 to 100,000.')
    if (tenths === null) throw new ApiError('Loss must be 0–50 % with at most one decimal.')
    const project = findProject(d, id)
    const lines = matchedLines(d, project.id)
    if (!lines.length) throw new ApiError('This project has no parts.')
    if (lines.some(l => !l.part)) throw new ApiError('Some parts are not in stock. Add them before proceeding.')
    const byId = new Map(lines.map(l => [l.part!.id, l.part!]))
    const parts = byPart(lines.map(l => ({ partId: l.part!.id, perBoard: l.line.qty_per_board })))
      .map(p => ({ ...p, part: byId.get(p.partId)!, need: needFor(p.perBoard, boards, tenths) }))
    return { project, parts, boards }
  }
  const short = (boards: number) => new ApiError(`Not enough stock for ${boards} boards.`, 409)

  return {
    // saved parts (filtered by folder incl. sub-folders and/or search) + folder tree + pending drafts
    parts({ cat, q }: { cat?: number | null; q?: string }): PartsResponse {
      const d = load()
      const cats = withCounts(d)
      const inFolder = cat ? new Set(descendantIds(cats, cat)) : null
      const needle = (q ?? '').slice(0, 100).toLowerCase()
      const saved = d.parts.filter(isSaved)
      const parts = saved
        .filter(p => !inFolder || (p.category_id !== null && inFolder.has(p.category_id)))
        .filter(p => !needle || [p.mpn, p.manufacturer, p.description, p.location].some(v => v.toLowerCase().includes(needle)))
        .sort((a, b) => a.mpn.localeCompare(b.mpn))
        .slice(0, 500)
        .map(p => ({ id: p.id, mpn: p.mpn, manufacturer: p.manufacturer, description: p.description, qty: p.qty,
          location: p.location, image_url: safeUrl(p.image_url), attrs: p.attrs, category_id: p.category_id,
          folder: p.category_id ? pathOf(cats, p.category_id) : '' }))
      const drafts = d.parts.filter(p => !isSaved(p)).sort((a, b) => b.id - a.id).slice(0, 20)
        .map(({ id, mpn, manufacturer }) => ({ id, mpn, manufacturer }))
      return { tree: buildTree(cats), total: saved.length, parts, drafts }
    },

    part(id: number): PartDetail {
      const d = load()
      const p = d.parts.find(x => x.id === id)
      if (!p) throw notFound()
      const cats = [...d.categories].sort(byName)
      const boms = d.bomItems.filter(i => i.part_id === p.id)
        .map(i => ({ id: i.bom_id, name: d.boms.find(b => b.id === i.bom_id)?.name ?? '', qty: i.qty })).sort(byName)
      const locations = [...new Set(d.parts.filter(isSaved).map(x => x.location).filter(Boolean))].sort().slice(0, 500)
      return { part: publicPart(p), folder: p.category_id ? pathOf(cats, p.category_id) : p.folder_hint,
        paths: cats.map(c => pathOf(cats, c.id)), boms, locations }
    },

    // Barcode (or typed part number) -> a restock offer if the part is already stocked, else a draft from the label data.
    // shortcut: first match only; two stocked parts sharing an MPN (different makers) would need a picker.
    scan(barcode: string, force = false): ScanResult {
      let p: ReturnType<typeof parse>
      try { p = parse(barcode) } catch { throw new ApiError('Could not read that barcode.') }
      return change(d => {
        const mpn = p.mpn ?? p.query
        if (force !== true) {
          const key = mpn.toUpperCase(), dist = (p.distPn ?? '').toUpperCase()
          const m = d.parts.filter(isSaved).sort((a, b) => a.id - b.id)
            .find(x => x.mpn.toUpperCase() === key || (dist !== '' && x.dist_pn.toUpperCase() === dist))
          if (m) return { match: { id: m.id, mpn: m.mpn, manufacturer: m.manufacturer, qty: m.qty, location: m.location }, qty: p.qty ?? null }
        }
        const id = d.nextId++
        d.parts.push({ id, status: 'draft', mpn: mpn.slice(0, 100), manufacturer: '', source: 'manual',
          dist_pn: (p.distPn ?? '').slice(0, 100), description: '', category_id: null, folder_hint: '', qty: p.qty ?? 1,
          location: '', datasheet_url: '', image_url: '', barcode: String(barcode).slice(0, 2048), attrs: {} })
        return { id }
      })
    },

    // reorder arrived: add the label's quantity to a saved part
    restock(id: number, qty: number): { ok: true; qty: number } {
      if (!(Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY)) throw new ApiError('Quantity must be 1 – 10,000,000.')
      return change(d => {
        const p = savedPart(d, id)
        if (p.qty + qty > MAX_QTY) throw notFound()
        p.qty += qty
        return { ok: true as const, qty: p.qty }
      })
    },

    // draft -> saved (or edit a saved part). Same MPN+manufacturer already stocked => quantity is added to it.
    save(id: number, form: PartForm): { ok: true; merged: boolean } {
      const f = readPartForm(form)
      if ('error' in f) throw new ApiError(f.error!)
      return change(d => {
        const cur = d.parts.find(x => x.id === id)
        if (!cur) throw notFound()
        const same = (x: StoredPart) => x !== cur && isSaved(x) && x.mpn === f.mpn && x.manufacturer === f.manufacturer
        const dup = cur.status === 'draft' ? d.parts.find(same) : undefined
        if (dup) {
          dup.qty += f.qty
          d.parts = d.parts.filter(x => x !== cur)
        } else {
          if (d.parts.some(same)) throw new ApiError(COLLIDE, 409)
          Object.assign(cur, { status: 'saved', mpn: f.mpn, manufacturer: f.manufacturer, description: f.description,
            qty: f.qty, location: f.location, category_id: f.folder.length ? ensurePath(d, f.folder) : null })
        }
        pruneFolders(d)
        return { ok: true as const, merged: !!dup }
      })
    },

    discard(id: number): { ok: true } {
      return change(d => {
        d.parts = d.parts.filter(x => !(x.id === id && x.status === 'draft'))
        return { ok: true as const }
      })
    },

    // build history keeps its snapshot (mpn); reorder lists drop the part
    remove(id: number): { ok: true } {
      return change(d => {
        if (!d.parts.some(x => x.id === id && isSaved(x))) return { ok: true as const }
        d.parts = d.parts.filter(x => x.id !== id)
        d.bomItems = d.bomItems.filter(i => i.part_id !== id)
        for (const i of d.buildItems) if (i.part_id === id) i.part_id = null
        pruneFolders(d)
        return { ok: true as const }
      })
    },

    reset(): void {
      write(seedData())
    },

    // full backup of saved parts + folders
    exportJson() {
      const d = load()
      return { exported: new Date().toISOString(), categories: d.categories, parts: d.parts.filter(isSaved) }
    },

    // ---------- reorder lists: named lists of inventory parts to (re)order; rows read part data live ----------
    boms(): { boms: BomSummary[] } {
      const d = load()
      return { boms: [...d.boms].sort(byName).map(b => ({ ...b, items: d.bomItems.filter(i => i.bom_id === b.id).length })) }
    },

    bom(id: number): BomDetail {
      const d = load()
      const bom = findBom(d, id)
      return { bom: { id: bom.id, name: bom.name }, items: bomItems(d, bom.id) }
    },

    createBom(name: string): { id: number } {
      const n = listName(name)
      if (!n) throw new ApiError(NAME)
      return change(d => {
        if (d.boms.some(b => b.name === n)) throw new ApiError(BOM_DUP, 409)
        const id = d.nextId++
        d.boms.push({ id, name: n })
        return { id }
      })
    },

    renameBom(id: number, name: string): { ok: true } {
      const n = listName(name)
      if (!n) throw new ApiError(NAME)
      return change(d => {
        const bom = findBom(d, id)
        if (d.boms.some(b => b !== bom && b.name === n)) throw new ApiError(BOM_DUP, 409)
        bom.name = n
        return { ok: true as const }
      })
    },

    deleteBom(id: number): { ok: true } {
      return change(d => {
        d.boms = d.boms.filter(b => b.id !== id)
        d.bomItems = d.bomItems.filter(i => i.bom_id !== id)
        return { ok: true as const }
      })
    },

    // add a part (or replace its quantity if it's already on the list)
    addToBom(bomId: number, partId: number, qty: number): { ok: true } {
      const n = orderQty(qty)
      if (!n) throw new ApiError(ORDER_QTY)
      return change(d => {
        const bom = findBom(d, bomId)
        if (!d.parts.some(p => p.id === partId && isSaved(p))) throw new ApiError('Only saved inventory parts can be added.')
        const already = d.bomItems.find(i => i.bom_id === bom.id && i.part_id === partId)
        if (already) { already.qty = n; return { ok: true as const } }
        if (d.bomItems.filter(i => i.bom_id === bom.id).length >= MAX_ROWS) throw new ApiError(`A reorder list can hold at most ${MAX_ROWS} parts.`)
        d.bomItems.push({ bom_id: bom.id, part_id: partId, qty: n })
        return { ok: true as const }
      })
    },

    setBomQty(bomId: number, partId: number, qty: number): { ok: true } {
      const n = orderQty(qty)
      if (!n) throw new ApiError(ORDER_QTY)
      return change(d => {
        const item = d.bomItems.find(i => i.bom_id === bomId && i.part_id === partId)
        if (!item) throw notFound()
        item.qty = n
        return { ok: true as const }
      })
    },

    removeFromBom(bomId: number, partId: number): { ok: true } {
      return change(d => {
        d.bomItems = d.bomItems.filter(i => !(i.bom_id === bomId && i.part_id === partId))
        return { ok: true as const }
      })
    },

    // the list as an Excel file (same columns as the preview in BomPreview)
    bomXlsx(id: number): { fileName: string; bytes: Uint8Array } {
      const d = load()
      const bom = findBom(d, id)
      const rows = bomItems(d, bom.id).map(it => [
        it.qty, it.mpn, it.manufacturer, it.description, it.stock, it.location,
        it.digikey ? { text: 'DigiKey', url: it.digikey } : '',
        it.lcsc ? { text: 'LCSC', url: it.lcsc } : '',
        it.mouser ? { text: 'Mouser', url: it.mouser } : '',
        it.datasheet_url ? { text: 'Datasheet', url: it.datasheet_url } : '',
      ])
      const base = `${bom.name}-${new Date().toISOString().slice(0, 10)}`.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      return { fileName: `${base}.xlsx`, bytes: buildXlsx({ header: EXPORT_HEADER, rows }) }
    },

    // ---------- projects: a PCB's parts list imported from its BOM; lines match saved parts live ----------
    projects(): { projects: ProjectSummary[] } {
      const d = load()
      return { projects: [...d.projects].sort(byName)
        .map(p => ({ id: p.id, name: p.name, lines: d.projectLines.filter(l => l.project_id === p.id).length })) }
    },

    project(id: number): ProjectDetail {
      const d = load()
      const project = findProject(d, id)
      const lines = matchedLines(d, project.id).map(({ line: { mpn, manufacturer, supplier_pn, description, designators, qty_per_board }, part }) =>
        ({ mpn, manufacturer, supplier_pn, description, designators, qty_per_board,
          part: part ? { id: part.id, qty: part.qty, location: part.location } : null }))
      // shortcut: last 100 builds; page it if history ever matters beyond that
      const builds = d.builds.filter(b => b.project_id === project.id).sort((a, b) => b.id - a.id).slice(0, 100)
        .map(b => ({ id: b.id, boards: b.boards, loss_pct: b.loss_pct, created_at: b.created_at,
          pieces: d.buildItems.filter(i => i.build_id === b.id).reduce((s, i) => s + i.qty, 0) }))
      return { project: { ...project }, lines, builds }
    },

    createProject(name: string, fileName: string, lines: BomLine[]): { id: number } {
      const n = listName(name)
      if (!n) throw new ApiError(NAME)
      const r = readLines(lines)
      if (r.error !== undefined) throw new ApiError(r.error)
      return change(d => {
        if (d.projects.some(p => p.name === n)) throw new ApiError(PROJECT_DUP, 409)
        const id = d.nextId++
        d.projects.push({ id, name: n, file_name: clean(fileName, 200), loss_pct: null })
        d.projectLines.push(...toRows(id, r.lines))
        return { id }
      })
    },

    renameProject(id: number, name: string): { ok: true } {
      const n = listName(name)
      if (!n) throw new ApiError(NAME)
      return change(d => {
        const project = findProject(d, id)
        if (d.projects.some(p => p !== project && p.name === n)) throw new ApiError(PROJECT_DUP, 409)
        project.name = n
        return { ok: true as const }
      })
    },

    // build history stays (project_id -> null, project_name kept)
    deleteProject(id: number): { ok: true } {
      return change(d => {
        d.projects = d.projects.filter(p => p.id !== id)
        d.projectLines = d.projectLines.filter(l => l.project_id !== id)
        for (const b of d.builds) if (b.project_id === id) b.project_id = null
        return { ok: true as const }
      })
    },

    // Replace BOM (new revision): all lines swapped at once; history stays
    replaceLines(id: number, fileName: string, lines: BomLine[]): { ok: true } {
      const r = readLines(lines)
      if (r.error !== undefined) throw new ApiError(r.error)
      return change(d => {
        const project = findProject(d, id)
        project.file_name = clean(fileName, 200)
        d.projectLines = d.projectLines.filter(l => l.project_id !== project.id).concat(toRows(project.id, r.lines))
        return { ok: true as const }
      })
    },

    // Remove from stock: all parts or none (every line is checked before any stock changes).
    // requestId makes a retry of the same click harmless.
    build(id: number, boards: number, lossPct: number, requestId: string): { ok: true; buildId: number } {
      return change(d => {
        const p = plan(d, id, boards, lossPct)
        if (typeof requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new ApiError('Bad request id.')
        const done = d.builds.find(b => b.request_id === requestId)
        if (done) return { ok: true as const, buildId: done.id }
        if (p.parts.some(x => x.need > x.part.qty)) throw short(boards)
        const buildId = d.nextId++
        for (const x of p.parts) {
          x.part.qty -= x.need
          d.buildItems.push({ build_id: buildId, part_id: x.part.id, mpn: x.part.mpn, qty: x.need })
        }
        d.builds.push({ id: buildId, request_id: requestId, project_id: p.project.id, project_name: p.project.name,
          boards, loss_pct: lossPct, created_at: new Date().toISOString() })
        p.project.loss_pct = lossPct
        return { ok: true as const, buildId }
      })
    },

    // Undo the latest build only (puts back exactly what it took), so stock is never rebuilt out of order
    undoBuild(id: number, buildId: number): { ok: true } {
      return change(d => {
        const latest = Math.max(...d.builds.filter(b => b.project_id === id).map(b => b.id))
        if (buildId !== latest) throw new ApiError('Only the latest build can be undone.', 409)
        for (const i of d.buildItems) {
          const part = i.build_id === buildId && i.part_id !== null ? d.parts.find(p => p.id === i.part_id) : undefined
          if (part) part.qty += i.qty
        }
        d.builds = d.builds.filter(b => b.id !== buildId)
        d.buildItems = d.buildItems.filter(i => i.build_id !== buildId)
        return { ok: true as const }
      })
    },

    // Short parts -> a reorder list, quantity = what's missing for the boards asked (replaces a quantity already there)
    shortagesToList(id: number, boards: number, lossPct: number, bomId: number): { ok: true; added: number } {
      return change(d => {
        const p = plan(d, id, boards, lossPct)
        const list = findBom(d, Number.isInteger(bomId) ? bomId : 0)
        const missing = p.parts.filter(x => x.need > x.part.qty)
        if (!missing.length) return { ok: true as const, added: 0 }
        const onList = new Set(d.bomItems.filter(i => i.bom_id === list.id).map(i => i.part_id))
        if (new Set([...onList, ...missing.map(x => x.partId)]).size > MAX_ROWS) throw new ApiError(`A reorder list can hold at most ${MAX_ROWS} parts.`)
        for (const x of missing) {
          const qty = x.need - x.part.qty
          const item = d.bomItems.find(i => i.bom_id === list.id && i.part_id === x.partId)
          if (item) item.qty = qty
          else d.bomItems.push({ bom_id: list.id, part_id: x.partId, qty })
        }
        return { ok: true as const, added: missing.length }
      })
    },
  }
}

export type Store = ReturnType<typeof createStore>
