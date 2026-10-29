import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildXlsx, zip } from '../web/src/lib/xlsx.ts'
import { readBomFile, xlsxRows, csvRows, extractLines } from '../web/src/lib/bomImport.ts'

// Shaped like an Altium export (shared strings, numeric quantities, "… 1" column names). Invented data.
function sampleXlsx() {
  const strings = ['Line #', 'Name', 'Description', 'Designator', 'Quantity', 'Manufacturer 1', 'Manufacturer Part Number 1',
    'Supplier 1', 'Supplier Part Number 1', 'DEMO-HDR20-ND', 'CONN HDR 20POS 0.1 GOLD PCB', 'J1', 'Sullins Connector Solutions',
    'DEMO-HDR20', 'Digikey', 'J2', 'RES 10K OHM 5% 1/4W AXIAL', 'R1, R2, R3, R4, R7, R8', 'YAGEO', 'DEMO-RES-10K',
    'DEMO-RES-10K-ND', 'Würth Elektronik', 'DEMO-LED-GRN', 'LED GREEN', 'D1', 'C&amp;K', 'DEMO-TACT-SW', 'SW1']
  const sst = `<sst xmlns="x" count="${strings.length}">${strings.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`
  const s = i => `t="s"><v>${i}</v>`
  const n = v => `><v>${v}</v>`
  const row = (r, cells) => `<row r="${r}">${cells.map((c, i) => `<c r="${String.fromCharCode(65 + i)}${r}" ${c}</c>`).join('')}</row>`
  const sheet = '<worksheet xmlns="x"><sheetData>' +
    row(1, [0, 1, 2, 3, 4, 5, 6, 7, 8].map(s)) +
    row(2, [n(1), s(9), s(10), s(11), n(1), s(12), s(13), s(14), s(9)]) +
    row(3, [n(2), s(19), s(16), s(17), n(6), s(18), s(19), s(14), s(20)]) +
    row(4, [n(3), s(9), s(10), s(15), n(1), s(12), s(13), s(14), s(9)]) +
    row(5, [n(4), s(22), s(23), s(24), n(1), s(21), s(22), s(14), s(22)]) +
    row(6, [n(5), s(26), s(23), s(27), n(1), s(25), s(26), s(14), s(26)]) +
    '</sheetData></worksheet>'
  return new Uint8Array(zip({ '[Content_Types].xml': '<Types/>', 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet }))
}

test('xlsx shaped like the Altium sample', async () => {
  const r = await readBomFile('demo-board-v1PrjPcb.xlsx', sampleXlsx())
  assert.equal(r.ok, true)
  assert.deepEqual(r.skipped, { noMpn: 0, notFitted: 0 })
  assert.deepEqual(r.lines.map(l => l.mpn), ['DEMO-HDR20', 'DEMO-RES-10K', 'DEMO-LED-GRN', 'DEMO-TACT-SW'])
  assert.deepEqual(r.lines[0], { mpn: 'DEMO-HDR20', manufacturer: 'Sullins Connector Solutions', supplierPn: 'DEMO-HDR20-ND',
    description: 'CONN HDR 20POS 0.1 GOLD PCB', designators: 'J1, J2', qty: 2 })
  assert.equal(r.lines[1].qty, 6)
  assert.equal(r.lines[1].designators, 'R1, R2, R3, R4, R7, R8')
  assert.equal(r.lines[2].manufacturer, 'Würth Elektronik')
  assert.equal(r.lines[3].manufacturer, 'C&K')
})

test('buildXlsx output (inline strings) also reads', async () => {
  assert.deepEqual(await xlsxRows(new Uint8Array(buildXlsx({ header: ['MPN', 'Qty'], rows: [['A1', 3]] }))), [['MPN', 'Qty'], ['A1', '3']])
})

test('rich-text shared strings, entities and multi-letter columns', async () => {
  const sst = '<sst><si><r><t>Fo</t></r><r><t xml:space="preserve">o &lt;1&gt; &#252;&#x21;</t></r></si></sst>'
  const sheet = '<worksheet><sheetData><row r="1"><c r="AA1" t="s"><v>0</v></c></row></sheetData></worksheet>'
  const rows = await xlsxRows(new Uint8Array(zip({ 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet })))
  assert.equal(rows[0].length, 27)
  assert.equal(rows[0][26], 'Foo <1> ü!')
})

test('self-closing <si/> and <t/> keep shared strings aligned', async () => {
  const sst = '<sst><si><t>MPN</t></si><si/><si><t>Qty</t></si><si><t>ABC</t></si>' +
    '<si><r><t xml:space="preserve"/></r><r><t>X</t></r></si></sst>'
  const c = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`
  const sheet = `<worksheet><sheetData><row r="1">${c('A1', 0)}${c('B1', 2)}</row><row r="2">${c('A2', 3)}<c r="B2"><v>1</v></c>${c('C2', 1)}${c('D2', 4)}</row></sheetData></worksheet>`
  const rows = await xlsxRows(new Uint8Array(zip({ 'xl/sharedStrings.xml': sst, 'xl/worksheets/sheet1.xml': sheet })))
  assert.deepEqual(rows, [['MPN', 'Qty'], ['ABC', '1', '', 'X']])
})

test('csv: semicolons, quotes, BOM', () => {
  assert.deepEqual(csvRows('﻿MPN;Qty;Designator\r\nX1;2;"R1; R2"\n'), [['MPN', 'Qty', 'Designator'], ['X1', '2', 'R1; R2']])
  assert.deepEqual(csvRows('MPN,Qty,Designator\n"X ""big""",2,"R1, R2"'), [['MPN', 'Qty', 'Designator'], ['X "big"', '2', 'R1, R2']])
  assert.deepEqual(csvRows('MPN,Note\nX,"two\nlines"\n'), [['MPN', 'Note'], ['X', 'two\nlines']])
})

test('header below a title block', () => {
  const r = extractLines([['Project X'], [], ['Designator', 'Qty', 'MPN'], ['R1', '1', 'A']])
  assert.equal(r.ok, true)
  assert.deepEqual(r.lines, [{ mpn: 'A', manufacturer: '', supplierPn: '', description: '', designators: 'R1', qty: 1 }])
})

test('quantity cells', () => {
  const head = ['MPN', 'Quantity']
  const r = extractLines([head, ['A', '6.0'], ['B', ''], ['C', '0'], ['', '3'], [], ['D', ' 2 ']])
  assert.deepEqual(r.lines.map(l => [l.mpn, l.qty]), [['A', 6], ['D', 2]])
  assert.deepEqual(r.skipped, { noMpn: 1, notFitted: 2 })
  assert.deepEqual(extractLines([head, ['A', '1'], ['B', '6.5']]), { ok: false, error: 'Row 3: quantity "6.5" is not a whole number.' })
  assert.deepEqual(extractLines([head, ['B', '-1']]), { ok: false, error: 'Row 2: quantity "-1" is not a whole number.' })
})

test('supplier part number never counts as the part number column', () => {
  const r = extractLines([['Supplier Part Number 1', 'Quantity', 'Part Number'], ['S-ND', '1', 'P1']])
  assert.equal(r.lines[0].mpn, 'P1')
  assert.equal(r.lines[0].supplierPn, 'S-ND')
})

test('missing columns', () => {
  assert.deepEqual(extractLines([['Designator', 'Qty'], ['R1', '1']]), { ok: false, error: 'No part number column found.' })
  assert.deepEqual(extractLines([['MPN', 'Designator'], ['A', 'R1']]), { ok: false, error: 'No quantity column found.' })
})

test('limits', () => {
  const many = [['MPN', 'Qty'], ...Array.from({ length: 501 }, (_, i) => [`P${i}`, '1'])]
  assert.deepEqual(extractLines(many), { ok: false, error: 'A project can have at most 500 parts.' })
  assert.deepEqual(extractLines([['MPN', 'Qty'], ['A', '60000'], ['a', '40001']]), { ok: false, error: 'A: more than 100,000 per board.' })
  assert.deepEqual(extractLines([['MPN', 'Qty'], ['A', '0']]), { ok: false, error: 'No parts found in this file.' })
})

test('readBomFile checks type and size', async () => {
  assert.deepEqual(await readBomFile('bom.txt', new Uint8Array(3)), { ok: false, error: 'Use the BOM exported from Altium as .xlsx or .csv.' })
  assert.deepEqual(await readBomFile('bom.csv', new Uint8Array(2 * 1024 * 1024 + 1)), { ok: false, error: 'That file is over 2 MB.' })
  const csv = await readBomFile('BOM.CSV', new TextEncoder().encode('MPN,Qty\nA,2\n'))
  assert.deepEqual(csv.lines.map(l => [l.mpn, l.qty]), [['A', 2]])
})

test('the public sample BOM imports cleanly', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('../web/public/sample-bom.csv', import.meta.url)))
  const r = await readBomFile('sample-bom.csv', bytes)
  assert.equal(r.ok, true)
  assert.equal(r.lines.length, 11)
  assert.equal(r.lines.find(l => l.mpn === 'RC0603FR-0710KL').qty, 3)
})
