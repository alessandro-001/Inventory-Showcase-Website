import test from 'node:test'
import assert from 'node:assert/strict'
import { packageKind } from '../web/src/lib/packageKind.ts' // Node runs .ts directly (type stripping)

test('placeholder package guessed from folder / description', () => {
  assert.equal(packageKind('Capacitors / Ceramic'), 'capacitor')
  assert.equal(packageKind('', '100nF 16V X7R 0603'), 'capacitor')
  assert.equal(packageKind('Resistors'), 'resistor')
  assert.equal(packageKind('', '10k ohm 1%'), 'resistor')
  assert.equal(packageKind('', '4.7kΩ'), 'resistor')
  assert.equal(packageKind('', 'Power inductor 4.7uH'), 'inductor')
  assert.equal(packageKind('Diodes / Schottky'), 'diode')
  assert.equal(packageKind('Microcontrollers', 'STM32F103C8T6'), 'chip')
  assert.equal(packageKind(''), 'chip')
})
