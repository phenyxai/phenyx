import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cn } from './utils.ts'

test('cn keeps a type role beside a color and lets a later role win', () => {
  assert.equal(cn('text-body text-[var(--stellar)]', 'text-ph-white'), 'text-body text-ph-white')
  assert.equal(cn('text-body', 'text-meta'), 'text-meta')
})
