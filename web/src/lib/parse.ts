// Barcode text -> { query, mpn?, distPn?, qty?, label? }   label = 'DigiKey' | 'Mouser' | 'LCSC' (which label was scanned)
// DigiKey/Mouser 2D labels are ISO 15434 / ANSI MH10.8.2: "[)>" RS "06" GS <DI><data> GS ...
// DIs used: 1P = manufacturer PN, 30P = supplier (DigiKey) PN, P = customer PN, Q = quantity.
// DigiKey adds 30P and 11Z/12Z/13Z pick codes; Mouser adds 14K (line) and 1V (manufacturer).
// LCSC QR is "{pbn:…,on:…,pc:C123,pm:<MPN>,qty:100,…}".
// shortcut: only the fields we need; the Mouser/LCSC formats are from public examples, validate against REAL labels.
export type Label = 'DigiKey' | 'Mouser' | 'LCSC'
export interface Parsed { query: string; mpn?: string; distPn?: string; qty?: number; label?: Label }

const SEP = /[\x1d\x1e\x04]|<GS>|<RS>|<EOT>/
const FIELD = /^(\d{0,2}[A-Z])(.*)$/s
const LCSC = /^\{.*\bpm:/s

const labelOf = (f: Record<string, string>): Label | undefined =>
  ('30P' in f || '11Z' in f || '12Z' in f || '13Z' in f) ? 'DigiKey' : ('14K' in f || '1V' in f) ? 'Mouser' : undefined

const toQty = (s: string | undefined) => {
  const n = parseInt(s ?? '', 10)
  return n >= 1 && n <= 10_000_000 ? n : undefined
}

export function parse(input: unknown): Parsed {
  const text = String(input ?? '').trim()
  if (!text || text.length > 2048) throw new RangeError('barcode empty or too long')

  if (text.startsWith('[)>')) {
    const f: Record<string, string> = {}
    for (const part of text.split(SEP).slice(1)) {
      const m = FIELD.exec(part)
      if (m && !(m[1] in f)) f[m[1]] = m[2].trim()
    }
    const mpn = f['1P'] || undefined
    const distPn = f['30P'] || f.P || undefined
    const label = labelOf(f)
    if (mpn || distPn) return { query: (distPn || mpn)!, mpn, distPn, qty: toQty(f.Q), ...(label && { label }) }
  }
  if (LCSC.test(text)) {
    const f = Object.fromEntries(text.slice(1, -1).split(',').map(kv => [kv.slice(0, kv.indexOf(':')), kv.slice(kv.indexOf(':') + 1).trim()]))
    const mpn = f.pm || undefined
    const distPn = f.pc || undefined
    if (mpn || distPn) return { query: (mpn || distPn)!, mpn, distPn, qty: toQty(f.qty), label: 'LCSC' }
  }
  // typed by hand (MPN or distributor PN): strip control chars
  const clean = text.replace(/[\x00-\x1f\x7f]/g, '').trim()
  if (!clean) throw new RangeError('barcode empty')
  return { query: clean, mpn: clean }
}
