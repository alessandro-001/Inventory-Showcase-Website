import test from 'node:test'
import assert from 'node:assert/strict'
import { parse } from '../web/src/lib/parse.ts'

// SYNTHETIC label built from the MH10.8.2 spec — NOT a real DigiKey label.
const label = '[)>\x1e06\x1dP296-6501-1-ND\x1d1PGRM188R71H104KA93D\x1d30P296-6501-1-ND\x1dK\x1d1K123456\x1dQ3000\x1d4LCN\x1e\x04'

test('MH10.8.2 label -> mpn, distributor PN, qty', () => {
  assert.deepEqual(parse(label), {
    query: '296-6501-1-ND', mpn: 'GRM188R71H104KA93D', distPn: '296-6501-1-ND', qty: 3000, label: 'DigiKey',
  })
})

// SYNTHETIC Mouser label (MH10.8.2 with Mouser's 14K line / 1V manufacturer fields) — verify against a real one.
test('Mouser label is recognised', () => {
  const r = parse('[)>\x1e06\x1dK\x1d14K001\x1d1PLM358DR\x1dQ25\x1d11K12345\x1d4LMY\x1d1VTexas Instruments\x1e\x04')
  assert.equal(r.label, 'Mouser'); assert.equal(r.mpn, 'LM358DR'); assert.equal(r.qty, 25)
})

// SYNTHETIC LCSC reel/bag QR in the publicly documented format (order/pick numbers invented).
test('LCSC QR -> mpn, LCSC part number, qty', () => {
  assert.deepEqual(parse('{pbn:PICK0000000001,on:SO0000000001,pc:C25804,pm:0603WAF1002T5E,qty:100,mc:,cc:1,pdi:10000001,hp:null,wc:JS}'), {
    query: '0603WAF1002T5E', mpn: '0603WAF1002T5E', distPn: 'C25804', qty: 100, label: 'LCSC',
  })
})

test('generic 2D label without distributor fields has no label name', () => {
  assert.equal(parse('[)>\x1e06\x1d1PABC\x1dQ1').label, undefined)
})

test('label with printable separators (some scanner apps)', () => {
  const r = parse('[)>\x1e06<GS>1PABC123<GS>Q10<RS><EOT>')
  assert.equal(r.mpn, 'ABC123'); assert.equal(r.qty, 10)
})

test('plain typed part number', () => {
  assert.deepEqual(parse('  NE555P \n'), { query: 'NE555P', mpn: 'NE555P' })
})

test('rejects empty and oversized input', () => {
  assert.throws(() => parse('   '), RangeError)
  assert.throws(() => parse('x'.repeat(2049)), RangeError)
})

test('absurd quantity ignored', () => {
  assert.equal(parse('[)>\x1e06\x1d1PX\x1dQ99999999999').qty, undefined)
})
