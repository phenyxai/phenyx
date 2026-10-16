import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closeAccountClientError, profileEditClientError } from './validation.ts'

test('closeAccountClientError: missing code first, then phrase', () => {
  assert.equal(
    closeAccountClientError('', ''),
    'enter the code we sent to your email.',
  )
  assert.equal(
    closeAccountClientError('123456', 'please delete'),
    'type delete my account exactly, to confirm.',
  )
  assert.equal(closeAccountClientError('123456', '  DELETE MY ACCOUNT  '), null)
})

test('profileEditClientError requires the emailed code', () => {
  assert.equal(
    profileEditClientError(''),
    'enter the code we sent to your email.',
  )
  assert.equal(profileEditClientError('123456'), null)
})
