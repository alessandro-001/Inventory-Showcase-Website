// Minimal .xlsx writer (one sheet "BOM"), no dependencies, runs in the browser.
// Security: every cell is an inline string or a number — never a formula — so part text like "=cmd|..." stays text.
// Links use the sheet's hyperlink relationships (clickable in Excel), not HYPERLINK() formulas.
// shortcut: columns A–Z only (we export 10); add multi-letter column names if that ever grows.

export type Cell = string | number | null | undefined | { text: string; url: string }

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
// chars XML 1.0 allows (astral chars are dropped too, as before)
const xmlOk = (c: number) => c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd)
const esc = (s: unknown) => [...String(s)].filter(ch => xmlOk(ch.codePointAt(0)!)).join('')
  .replace(/[&<>"']/g, c => ESC[c])
const col = (i: number) => String.fromCharCode(65 + i)
const text = (ref: string, value: unknown, style?: number) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(value)}</t></is></c>`

export function buildXlsx({ header, rows }: { header: string[]; rows: Cell[][] }): Uint8Array {
  const links: { ref: string; url: string }[] = []
  const cell = (v: Cell, ref: string) => {
    if (v === null || v === undefined || v === '') return ''
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`
    if (typeof v === 'object') { links.push({ ref, url: v.url }); return text(ref, v.text, 2) }
    return text(ref, v)
  }
  const width = (i: number) => Math.min(60, Math.max(10, ...[header[i], ...rows.map(r => r[i])]
    .map(v => String(typeof v === 'object' && v ? v.text : v ?? '').length + 2)))

  const sheetRows = [
    `<row r="1">${header.map((h, i) => text(`${col(i)}1`, h, 1)).join('')}</row>`,
    ...rows.map((r, y) => `<row r="${y + 2}">${r.map((v, i) => cell(v, `${col(i)}${y + 2}`)).join('')}</row>`),
  ].join('')

  const sheet = XML + `<worksheet xmlns="${NS}" xmlns:r="${R_NS}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${header.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${width(i)}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${sheetRows}</sheetData>` +
    (links.length ? `<hyperlinks>${links.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rId${i + 1}"/>`).join('')}</hyperlinks>` : '') +
    '</worksheet>'

  const files: Record<string, string> = {
    '[Content_Types].xml': XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels': XML + `<Relationships xmlns="${PKG_NS}">` +
      `<Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': XML + `<workbook xmlns="${NS}" xmlns:r="${R_NS}"><sheets><sheet name="BOM" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': XML + `<Relationships xmlns="${PKG_NS}">` +
      `<Relationship Id="rId1" Type="${R_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${R_NS}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': XML + `<styleSheet xmlns="${NS}">` +
      '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><u/><sz val="11"/><color rgb="FF1D6B42"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml': sheet,
  }
  if (links.length) {
    files['xl/worksheets/_rels/sheet1.xml.rels'] = XML + `<Relationships xmlns="${PKG_NS}">` +
      links.map((l, i) => `<Relationship Id="rId${i + 1}" Type="${R_NS}/hyperlink" Target="${esc(l.url)}" TargetMode="External"/>`).join('') +
      '</Relationships>'
  }
  return zip(files)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (b: Uint8Array) => {
  let c = ~0
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

// Plain zip, UTF-8 names, fixed 1980-01-01 timestamp. Exported for test fixtures.
// shortcut: entries are stored, not deflated (the browser's CompressionStream is async); a few KB larger per file.
export function zip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder()
  const out: Uint8Array[] = [], centrals: Uint8Array[] = []
  let offset = 0
  const header = (size: number, write: (v: DataView) => void) => {
    const b = new Uint8Array(size)
    write(new DataView(b.buffer))
    return b
  }
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = enc.encode(name)
    const data = enc.encode(content)
    const crc = crc32(data)
    out.push(header(30, v => {
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(12, 0x21, true)
      v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true)
      v.setUint16(26, nameBuf.length, true)
    }), nameBuf, data)
    centrals.push(header(46, v => {
      v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true)
      v.setUint16(14, 0x21, true); v.setUint32(16, crc, true); v.setUint32(20, data.length, true); v.setUint32(24, data.length, true)
      v.setUint16(28, nameBuf.length, true); v.setUint32(42, offset, true)
    }), nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const count = Object.keys(files).length
  const cdLength = centrals.reduce((s, b) => s + b.length, 0)
  const end = header(22, v => {
    v.setUint32(0, 0x06054b50, true); v.setUint16(8, count, true); v.setUint16(10, count, true)
    v.setUint32(12, cdLength, true); v.setUint32(16, offset, true)
  })
  const all = [...out, ...centrals, end]
  const result = new Uint8Array(all.reduce((s, b) => s + b.length, 0))
  let p = 0
  for (const b of all) { result.set(b, p); p += b.length }
  return result
}
