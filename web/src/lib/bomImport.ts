// Reads an Altium BOM export (.xlsx or .csv) in the browser -> merged lines. The server only ever gets these lines,
// never the file. No dependencies: zip via the central directory + DecompressionStream, XML via a few regexes
// (enough for spreadsheet cells; no DOMParser so tests run under Node).

export interface BomLine { mpn: string; manufacturer: string; supplierPn: string; description: string; designators: string; qty: number }
export type ImportResult =
  | { ok: true; lines: BomLine[]; skipped: { noMpn: number; notFitted: number } }
  | { ok: false; error: string }

const MAX_BYTES = 2 * 1024 * 1024
const MAX_LINES = 500
const MAX_PER_BOARD = 100_000
const fail = (error: string): ImportResult => ({ ok: false, error })

export async function readBomFile(fileName: string, bytes: Uint8Array): Promise<ImportResult> {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext !== 'xlsx' && ext !== 'csv') return fail('Use the BOM exported from Altium as .xlsx or .csv.')
  if (bytes.length > MAX_BYTES) return fail('That file is over 2 MB.')
  try {
    return extractLines(ext === 'csv' ? csvRows(new TextDecoder().decode(bytes)) : await xlsxRows(bytes))
  } catch {
    return fail('Could not read that file. Export the BOM from Altium again as .xlsx or .csv.')
  }
}

// ---------- xlsx ----------

async function unzip(bytes: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('not a zip')
  const files = new Map<string, () => Promise<string>>()
  let p = v.getUint32(end + 16, true)
  for (let i = v.getUint16(end + 10, true); i > 0; i--) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip')
    const method = v.getUint16(p + 10, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const local = v.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const data = bytes.slice(start, start + size)
    files.set(name, () => method === 0 ? Promise.resolve(new TextDecoder().decode(data))
      : new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text())
  }
  return files
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1), e[1] === 'x' || e[1] === 'X' ? 16 : 10))
    : ENTITY[e] ?? m)
// all <t> text inside a fragment (rich text = several runs); phonetic hints (<rPh>) aren't part of the value
// (self-closing <t/> and <si/> are empty values, and must not swallow the next element)
const texts = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/t>)/g)]
  .map(m => decode(m[1] ?? '')).join('')
const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

// rows of the first worksheet as strings
export async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes)
  const sheetName = files.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml'
    : [...files.keys()].filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0]
  if (!sheetName) throw new Error('no worksheet')
  const shared = files.get('xl/sharedStrings.xml')
  const strings = shared ? [...(await shared()).matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m => texts(m[1] ?? '')) : []
  const sheet = await files.get(sheetName)!()
  const rows: string[][] = []
  for (const [, rowAttrs, rowXml] of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(/\br="(\d+)"/.exec(rowAttrs)?.[1] ?? rows.length + 1) - 1
    const row: string[] = []
    for (const [, attrs, inner = ''] of (rowXml ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1]
      const type = /\bt="(\w+)"/.exec(attrs)?.[1]
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? ''
      const value = type === 's' ? strings[Number(raw)] ?? '' : type === 'inlineStr' ? texts(inner) : decode(raw)
      const at = ref ? colIndex(ref) : row.length
      while (row.length < at) row.push('')
      row[at] = value
    }
    while (rows.length < r) rows.push([])
    rows[r] = row
  }
  return rows
}

// ---------- csv ----------

export function csvRows(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const first = text.split(/\r?\n/, 1)[0]
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// ---------- rows -> lines ----------

const ALIASES = {
  mpn: ['manufacturer part number', 'manufacturer part', 'mpn', 'part number'],
  qty: ['quantity', 'qty'],
  designators: ['designator', 'designators'],
  manufacturer: ['manufacturer'],
  description: ['description'],
  supplierPn: ['supplier part number'],
}
const norm = (h: string) => h.toLowerCase().trim().replace(/\s+/g, ' ').replace(/ 1$/, '')
const findCol = (header: string[], names: string[]) => {
  const n = header.map(norm)
  for (const name of names) { const i = n.indexOf(name); if (i >= 0) return i }
  return -1
}

export function extractLines(rows: string[][]): ImportResult {
  let h = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (findCol(rows[i] ?? [], ALIASES.mpn) >= 0 && findCol(rows[i] ?? [], ALIASES.qty) >= 0) { h = i; break }
  }
  if (h < 0) {
    return fail(rows.slice(0, 10).some(r => findCol(r ?? [], ALIASES.mpn) >= 0) ? 'No quantity column found.' : 'No part number column found.')
  }
  const header = rows[h]
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, findCol(header, names)])) as Record<keyof typeof ALIASES, number>
  const merged = new Map<string, BomLine>()
  const skipped = { noMpn: 0, notFitted: 0 }
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    if (!row.some(c => c.trim())) continue
    const get = (k: keyof typeof ALIASES) => (col[k] >= 0 ? (row[col[k]] ?? '').trim() : '')
    const mpn = get('mpn')
    if (!mpn) { skipped.noMpn++; continue }
    const rawQty = get('qty')
    if (rawQty === '') { skipped.notFitted++; continue }
    if (!/^\d+(\.0+)?$/.test(rawQty)) return fail(`Row ${i + 1}: quantity "${rawQty}" is not a whole number.`)
    const qty = parseInt(rawQty, 10)
    if (qty === 0) { skipped.notFitted++; continue }
    const key = mpn.toUpperCase()
    const line = merged.get(key)
    if (!line) {
      merged.set(key, { mpn, manufacturer: get('manufacturer'), supplierPn: get('supplierPn'), description: get('description'),
        designators: get('designators'), qty })
      continue
    }
    line.qty += qty
    line.designators = [line.designators, get('designators')].filter(Boolean).join(', ')
    for (const k of ['manufacturer', 'supplierPn', 'description'] as const) line[k] ||= get(k)
  }
  const lines = [...merged.values()]
  if (!lines.length) return fail('No parts found in this file.')
  if (lines.length > MAX_LINES) return fail(`A project can have at most ${MAX_LINES} parts.`)
  const big = lines.find(l => l.qty > MAX_PER_BOARD)
  if (big) return fail(`${big.mpn}: more than 100,000 per board.`)
  return { ok: true, lines, skipped }
}
