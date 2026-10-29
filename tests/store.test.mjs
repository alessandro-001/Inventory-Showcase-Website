import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore, STORAGE_KEY } from '../web/src/demo/store.ts'
import { unzip } from './helpers/unzip.mjs'

const memory = () => {
  const m = new Map()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}
const fresh = () => createStore(memory())
const find = (s, mpn) => s.parts({ q: mpn }).parts.find(p => p.mpn === mpn)
const form = (p, over = {}) => ({ mpn: p.mpn, manufacturer: p.manufacturer, description: p.description,
  folder: p.folder, qty: String(p.qty), location: p.location, ...over })
const fails = (fn, message, status = 400) => assert.throws(fn, e => e.message === message && e.status === status)

const ESP = 'ESP32-S3-WROOM-1-N8R8'

test('restock instead of draft on a known MPN', () => {
  const s = fresh()
  const r = s.scan(ESP.toLowerCase())
  assert.equal(r.match.mpn, ESP)
  assert.equal(r.match.qty, 6)
  assert.equal(r.qty, null)
  const label = s.scan(`[)>\x1e06\x1d1P${ESP}\x1d30P1965-ESP32-S3-ND\x1dQ50\x1e\x04`)
  assert.equal(label.match.mpn, ESP)
  assert.equal(label.qty, 50)
  const forced = s.scan(ESP, true)
  assert.ok(forced.id)
  assert.equal(s.part(forced.id).part.status, 'draft')
})

test('typed MPN makes a draft with label data only', () => {
  const s = fresh()
  const { id } = s.scan('6N138')
  const { part } = s.part(id)
  assert.equal(part.status, 'draft')
  assert.equal(part.mpn, '6N138')
  assert.equal(part.source, 'manual')
  assert.equal(part.qty, 1)
  assert.equal(part.label, '')
  assert.equal(s.parts({}).drafts[0].id, id)
})

test('draft merge on save', () => {
  const s = fresh()
  const esp = find(s, ESP)
  const { id } = s.scan(ESP, true)
  assert.deepEqual(s.save(id, form(esp, { qty: '5' })), { ok: true, merged: true })
  assert.equal(find(s, ESP).qty, 11)
  fails(() => s.part(id), 'not found', 404)
})

test('save validates like the server', () => {
  const s = fresh()
  const esp = find(s, ESP)
  fails(() => s.save(esp.id, form(esp, { qty: '-1' })), 'Quantity must be 0 – 10,000,000.')
  fails(() => s.save(esp.id, form(esp, { mpn: '  ' })), 'Part number is required.')
  fails(() => s.save(esp.id, form(esp, { folder: 'a / b / c / d / e' })), 'Folder: max 4 levels, 60 characters each.')
  fails(() => s.save(9999, form(esp)), 'not found', 404)
})

test('save creates folders and prunes empty ones', () => {
  const s = fresh()
  const { id } = s.scan('6N138')
  s.save(id, { mpn: '6N138', manufacturer: 'Lite-On', description: 'Optocoupler', folder: 'Test / Only', qty: '10', location: '' })
  const test1 = s.parts({}).tree.find(f => f.name === 'Test')
  assert.equal(test1.total, 1)
  assert.equal(s.part(id).folder, 'Test / Only')
  s.save(id, { mpn: '6N138', manufacturer: 'Lite-On', description: 'Optocoupler', folder: '', qty: '10', location: '' })
  assert.equal(s.parts({}).tree.find(f => f.name === 'Test'), undefined)
})

test('search and folder filter', () => {
  const s = fresh()
  const hits = s.parts({ q: 'drawer a3' }).parts
  assert.ok(hits.length > 0)
  assert.ok(hits.every(p => p.location === 'Drawer A3'))
  const ics = s.parts({}).tree.find(f => f.name === 'ICs')
  const mpns = s.parts({ cat: ics.id }).parts.map(p => p.mpn)
  assert.ok(mpns.includes(ESP))
  assert.ok(mpns.includes('AMS1117-3.3'))
  assert.ok(!mpns.includes('B3F-1000'))
  assert.equal(s.parts({ q: 'ESP32' }).total, s.parts({}).total) // total ignores filters
})

test('restock', () => {
  const s = fresh()
  const esp = find(s, ESP)
  fails(() => s.restock(esp.id, 0), 'Quantity must be 1 – 10,000,000.')
  assert.deepEqual(s.restock(esp.id, 10), { ok: true, qty: 16 })
})

test('discard and delete only touch their own status', () => {
  const s = fresh()
  const esp = find(s, ESP)
  s.discard(esp.id) // saved: untouched
  assert.ok(find(s, ESP))
  s.remove(esp.id)
  assert.equal(find(s, ESP), undefined)
})

test('reset restores the seed', () => {
  const s = fresh()
  s.remove(find(s, ESP).id)
  s.scan('6N138')
  s.reset()
  assert.deepEqual(s.parts({}), fresh().parts({}))
})

test('exportJson holds the saved parts and folders', () => {
  const s = fresh()
  s.scan('6N138') // a draft: not exported
  const x = s.exportJson()
  assert.equal(x.parts.length, s.parts({}).total)
  assert.ok(x.categories.length > 0)
  assert.ok(x.exported)
})

// ---------- Review Focus ----------

test('a corrupt or foreign blob reseeds instead of throwing', () => {
  const total = fresh().parts({}).total
  for (const bad of ['{bad', '{"x":1}', 'null', '[]', '{"nextId":5,"parts":[]}']) { // last: an older or partial shape
    const storage = memory()
    storage.setItem(STORAGE_KEY, bad)
    const s = createStore(storage)
    assert.equal(s.parts({}).total, total, bad)
    assert.equal(s.boms().boms.length, 1, bad)
  }
})

test('blocked storage still works in memory', () => {
  const blocked = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('denied') } }
  for (const storage of [blocked, null]) {
    const s = createStore(storage)
    const { id } = s.scan('6N138')
    assert.equal(s.part(id).part.mpn, '6N138')
  }
  assert.equal(createStore(null).parts({}).drafts.length, 0) // each store has its own memory
})

test('two tabs do not overwrite each other', () => {
  const storage = memory()
  const a = createStore(storage), b = createStore(storage)
  const { id } = a.scan('6N138')
  b.restock(find(b, ESP).id, 4)
  assert.equal(a.part(id).part.mpn, '6N138')
  assert.equal(find(a, ESP).qty, 10)
})

test('unsafe datasheet URL is never returned', () => {
  const storage = memory()
  const s = createStore(storage)
  const esp = find(s, ESP)
  s.reset() // reads never write; put the seed in storage to tamper with it
  const data = JSON.parse(storage.getItem(STORAGE_KEY))
  data.parts.find(p => p.id === esp.id).datasheet_url = 'javascript:alert(1)'
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
  assert.equal(s.part(esp.id).part.datasheet_url, '')
})

test('editing a saved part into another saved part is refused', () => {
  const s = fresh()
  const esp = find(s, ESP)
  const ams = find(s, 'AMS1117-3.3')
  fails(() => s.save(esp.id, form(esp, { mpn: ams.mpn, manufacturer: ams.manufacturer })),
    'Could not save (another saved part may have the same MPN and manufacturer).', 409)
  assert.equal(find(s, ESP).qty, 6)
})

// ---------- Reorder lists, projects, builds ----------

const projectId = s => s.projects().projects.find(p => p.name === 'Demo MIDI controller').id
const listId = s => s.boms().boms.find(b => b.name === 'Restock — next order').id
const addOptocoupler = s => {
  const { id } = s.scan('6N138')
  s.save(id, { mpn: '6N138', manufacturer: 'Lite-On', description: 'Optocoupler', folder: 'ICs / Interface', qty: '100', location: 'Drawer A5' })
}
const stock = s => Object.fromEntries(s.parts({}).parts.map(p => [p.mpn, p.qty]))
const line = { manufacturer: '', supplierPn: '', description: '', designators: '' }

test('seeded project matches stock live', () => {
  const s = fresh()
  const { lines, builds } = s.project(projectId(s))
  assert.equal(lines.length, 12)
  assert.equal(lines.find(l => l.mpn === '6N138').part, null)
  assert.deepEqual(lines.find(l => l.mpn === ESP).part, { id: find(s, ESP).id, qty: 6, location: 'Drawer A3' })
  assert.equal(builds.length, 1)
  assert.equal(builds[0].pieces, 2 * (1 + 1 + 1 + 8 + 6 + 10 + 2 + 1 + 4 + 4 + 4))
})

test('build refused while a line is not in stock', () => {
  const s = fresh()
  fails(() => s.build(projectId(s), 1, 0, 'req-00000001'), 'Some parts are not in stock. Add them before proceeding.')
})

test('build all-or-nothing and refused when short', () => {
  const s = fresh()
  addOptocoupler(s)
  const p = projectId(s)
  const before = stock(s)
  fails(() => s.build(p, 10, 0, 'req-00000001'), 'Not enough stock for 10 boards.', 409)
  assert.deepEqual(stock(s), before)
  const { buildId } = s.build(p, 5, 0, 'req-00000002')
  assert.equal(stock(s)[ESP], 1)
  assert.equal(stock(s)['RC0603FR-0710KL'], 4800 - 40)
  assert.equal(stock(s)['6N138'], 95)
  assert.deepEqual(s.build(p, 5, 0, 'req-00000002'), { ok: true, buildId }) // retry: same build, nothing taken twice
  assert.equal(stock(s)[ESP], 1)
  fails(() => s.build(p, 0, 0, 'req-00000003'), 'Boards must be a whole number from 1 to 100,000.')
  fails(() => s.build(p, 1, 51, 'req-00000003'), 'Loss must be 0–50 % with at most one decimal.')
  fails(() => s.build(p, 1, 0, 'x'), 'Bad request id.')
})

test('undo latest build only', () => {
  const s = fresh()
  addOptocoupler(s)
  const p = projectId(s)
  const before = stock(s)
  const older = s.project(p).builds[0].id
  const { buildId } = s.build(p, 1, 0, 'req-00000004')
  fails(() => s.undoBuild(p, older), 'Only the latest build can be undone.', 409)
  s.undoBuild(p, buildId)
  assert.deepEqual(stock(s), before)
  assert.equal(s.project(p).builds.length, 1)
})

test('shortages to reorder list', () => {
  const s = fresh()
  addOptocoupler(s)
  const list = listId(s)
  assert.deepEqual(s.shortagesToList(projectId(s), 10, 0, list), { ok: true, added: 1 })
  assert.equal(s.bom(list).items.find(i => i.mpn === ESP).qty, 4) // replaces the 10 already there
})

test('project lines merge by MPN', () => {
  const s = fresh()
  const { id } = s.createProject('X', 'x.csv', [{ ...line, mpn: 'A1', designators: 'R1', qty: 1 }, { ...line, mpn: 'a1', designators: 'R2', qty: 2 }])
  const { lines } = s.project(id)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].qty_per_board, 3)
  assert.equal(lines[0].designators, 'R1, R2')
  fails(() => s.createProject('Demo MIDI controller', 'x.csv', [{ ...line, mpn: 'A1', qty: 1 }]), 'A project with that name already exists.', 409)
  fails(() => s.createProject('Y', 'y.csv', []), 'Send 1–500 parts.')
})

test('reorder list rules', () => {
  const s = fresh()
  fails(() => s.createBom('Restock — next order'), 'A reorder list with that name already exists.', 409)
  const { id } = s.scan('6N138')
  fails(() => s.addToBom(listId(s), id, 1), 'Only saved inventory parts can be added.')
  fails(() => s.addToBom(listId(s), find(s, ESP).id, 0), 'Quantity must be a whole number from 1 to 10,000,000.')
})

test('remove drops the part from reorder lists', () => {
  const s = fresh()
  s.remove(find(s, ESP).id)
  assert.equal(s.bom(listId(s)).items.length, 2)
})

test('bomXlsx builds the reorder list as a spreadsheet', () => {
  const s = fresh()
  const { fileName, bytes } = s.bomXlsx(listId(s))
  assert.ok(fileName.startsWith('Restock'))
  assert.ok(fileName.endsWith('.xlsx'))
  assert.ok(unzip(bytes)['xl/worksheets/sheet1.xml'].includes(ESP))
})

test('unsafe datasheet URL is never returned on a reorder list', () => {
  const storage = memory()
  const s = createStore(storage)
  s.reset()
  const data = JSON.parse(storage.getItem(STORAGE_KEY))
  data.parts.find(p => p.mpn === ESP).datasheet_url = 'javascript:alert(1)'
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
  assert.equal(s.bom(listId(s)).items.find(i => i.mpn === ESP).datasheet_url, '')
})
