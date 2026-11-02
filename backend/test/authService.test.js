import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthService, hashPassword, verifyPassword } from '../src/services/authService.js'

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

async function fakeAuthService(password) {
  const user = { id: 1, username: 'reception', passwordHash: await hashPassword(password) }
  const service = createAuthService({
    userRepo: {
      findById: async (id) => (id === user.id ? user : null),
      updatePasswordHash: async (id, passwordHash) => (user.passwordHash = passwordHash),
    },
  })
  return { service, user }
}

test('005 FR-019: the password is changed when the current password is correct', async () => {
  const { service, user } = await fakeAuthService('gammel-kode')
  await service.changePassword(1, 'gammel-kode', 'ny-kode-123')
  assert.equal(await verifyPassword('ny-kode-123', user.passwordHash), true)
  assert.equal(await verifyPassword('gammel-kode', user.passwordHash), false)
})

test('005 FR-019: a wrong current password is rejected and the password is unchanged', async () => {
  const { service, user } = await fakeAuthService('gammel-kode')
  const before = user.passwordHash
  await assert.rejects(service.changePassword(1, 'forkert', 'ny-kode-123'), {
    code: 'WRONG_PASSWORD',
    field: 'currentPassword',
  })
  assert.equal(user.passwordHash, before)
})
