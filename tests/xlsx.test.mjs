import test from 'node:test'
import assert from 'node:assert/strict'
import { buildXlsx } from '../web/src/lib/xlsx.ts'
import { distributorLinks } from '../web/src/lib/distributors.ts'
import { unzip } from './helpers/unzip.mjs'

const HEADER = ['Quantity to order', 'Manufacturer part number']
const sheet = rows => unzip(buildXlsx({ header: HEADER, rows }))['xl/worksheets/sheet1.xml']

test('xlsx is a zip with the required parts', () => {
  const buf = buildXlsx({ header: HEADER, rows: [[1, 'X']] })
  assert.ok(buf instanceof Uint8Array)
  assert.equal(new TextDecoder().decode(buf.subarray(0, 2)), 'PK')
  const files = Object.keys(unzip(buf))
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml'])
    assert.ok(files.includes(f), f)
})

test('cells are literal text, never formulas', () => {
  const xml = sheet([['=cmd|"/c calc"!A1', '+1', '-2', '@x', 'a<b&c"d', 'bad\u0001ctl']])
  assert.doesNotMatch(xml, /<f>/)
  assert.equal((xml.match(/t="inlineStr"/g) ?? []).length, HEADER.length + 6)
  assert.ok(xml.includes('=cmd|&quot;/c calc&quot;!A1'))
  assert.ok(xml.includes('a&lt;b&amp;c&quot;d'))
  assert.ok(!xml.includes('\u0001'))
})

test('numbers are numeric cells', () => {
  assert.ok(sheet([[1200]]).includes('<c r="A2"><v>1200</v></c>'))
})

test('link cells become hyperlinks', () => {
  const files = unzip(buildXlsx({ header: HEADER, rows: [[{ text: 'DigiKey', url: 'https://www.digikey.com/x?a=1&b=2' }]] }))
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('<hyperlink ref="A2" r:id="rId1"/>'))
  assert.ok(files['xl/worksheets/_rels/sheet1.xml.rels'].includes('Target="https://www.digikey.com/x?a=1&amp;b=2" TargetMode="External"'))
})

test('empty BOM still produces a valid file', () => {
  const xml = sheet([])
  assert.ok(xml.includes('<row r="1"'))
  assert.ok(!xml.includes('<row r="2"'))
})

test('distributor links are fixed https hosts with the MPN encoded', () => {
  const w = distributorLinks('GRM188 R7')
  assert.equal(w.find(l => l.name === 'Mouser').url, 'https://www.mouser.com/c/?q=GRM188%20R7')
  assert.ok(w.every(l => l.url.startsWith('https://')))
  assert.deepEqual(distributorLinks('  '), [])
})
