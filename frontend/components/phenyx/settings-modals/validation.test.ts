import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closeAccountClientError } from './validation.ts'

test('closeAccountClientError asks only for the typed phrase', () => {
  assert.equal(closeAccountClientError('please delete'), 'type delete my account exactly, to confirm.')
  assert.equal(closeAccountClientError('  DELETE MY ACCOUNT  '), null)
})
