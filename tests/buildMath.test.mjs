import test from 'node:test'
import assert from 'node:assert/strict'
import * as m from '../web/src/lib/buildMath.ts'

test('needFor rounds up in integer math', () => {
  assert.equal(m.needFor(3, 50, 30), 155) // 154.5 -> 155
  assert.equal(m.needFor(100, 1, 100), 110) // 100 × 1.1 in floats is 110.00000000000001 -> would be 111
  assert.equal(m.needFor(6, 50, 0), 300)
  assert.equal(m.needFor(1, 1, 1), 2) // 1.001 -> 2
})

test('lossTenths validates', () => {
  assert.equal(m.lossTenths(2.5), 25)
  assert.equal(m.lossTenths(0), 0)
  assert.equal(m.lossTenths(50), 500)
  for (const bad of [-0.1, 50.1, 2.55, NaN, Infinity, '3', null]) assert.equal(m.lossTenths(bad), null, String(bad))
})

test('maxBoards is exact at the rounding edge', () => {
  assert.equal(m.maxBoards([{ perBoard: 3, stock: 155 }], 30), 50)
  assert.equal(m.maxBoards([{ perBoard: 3, stock: 154 }], 30), 49)
  assert.equal(m.maxBoards([{ perBoard: 1, stock: 30 }, { perBoard: 2, stock: 60 }], 0), 30)
  assert.equal(m.maxBoards([{ perBoard: 5, stock: 4 }], 0), 0)
  assert.equal(m.maxBoards([{ perBoard: 1, stock: 10_000_000 }], 0), 100000)
  assert.equal(m.maxBoards([], 0), 100000)
})

test('byPart sums lines that match the same part', () => {
  assert.deepEqual(m.byPart([{ partId: 1, perBoard: 1 }, { partId: 2, perBoard: 6 }, { partId: 1, perBoard: 1 }]),
    [{ partId: 1, perBoard: 2 }, { partId: 2, perBoard: 6 }])
})
