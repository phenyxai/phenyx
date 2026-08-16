import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  closeAccountClientError,
  passphraseChangeClientError,
  profileEditClientError,
} from './validation.ts'

test('closeAccountClientError: empty passphrase first, then phrase', () => {
  assert.equal(
    closeAccountClientError('', ''),
    'enter your passphrase to confirm it is you.',
  )
  assert.equal(
    closeAccountClientError('secret', 'please delete'),
    'type delete my account exactly, to confirm.',
  )
  assert.equal(closeAccountClientError('secret', '  DELETE MY ACCOUNT  '), null)
})

test('passphraseChangeClientError covers the four invalid cases', () => {
  assert.equal(
    passphraseChangeClientError('', 'n', 'n'),
    'enter your current passphrase to confirm it is you.',
  )
  assert.equal(
    passphraseChangeClientError('cur', '', ''),
    'enter a new passphrase.',
  )
  assert.equal(
    passphraseChangeClientError('cur', 'a', 'b'),
    'the two new passphrases do not match.',
  )
  assert.equal(
    passphraseChangeClientError('same', 'same', 'same'),
    'that is your current passphrase. choose a different one.',
  )
  assert.equal(passphraseChangeClientError('old', 'new', 'new'), null)
})

test('profileEditClientError requires the current passphrase', () => {
  assert.equal(
    profileEditClientError(''),
    'enter your passphrase to confirm the change.',
  )
  assert.equal(profileEditClientError('secret'), null)
})
