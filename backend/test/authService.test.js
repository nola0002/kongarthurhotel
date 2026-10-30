import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from '../src/services/authService.js'

test('FR-015: the correct password verifies against its hash', async () => {
  assert.equal(await verifyPassword('skift-mig', await hashPassword('skift-mig')), true)
})

test('FR-015: a wrong password does not verify', async () => {
  assert.equal(await verifyPassword('forkert', await hashPassword('skift-mig')), false)
})

test('FR-015: a stored value in an unknown format does not verify', async () => {
  assert.equal(await verifyPassword('skift-mig', 'skift-mig'), false)
  assert.equal(await verifyPassword('skift-mig', 'scrypt$abcd'), false)
})
