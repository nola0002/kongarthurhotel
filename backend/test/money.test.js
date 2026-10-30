import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toOre, toKr } from '../src/money.js'

test('FR-009: converts DECIMAL strings to øre and back without floats', () => {
  assert.equal(toOre('1800.50'), 180050)
  assert.equal(toKr(180050), 1800.5)
  assert.equal(toOre('0.10'), 10)
  assert.equal(toKr(10), 0.1)
  assert.equal(toOre('500'), 50000)
})
