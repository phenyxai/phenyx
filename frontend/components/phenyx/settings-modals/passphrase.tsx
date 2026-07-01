'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import {
  GhostButton,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

const fieldClassName =
  'w-full rounded-md border border-[#222] bg-[#111] px-3 py-2 text-[13px] text-[#FFFDFD] outline-none focus:border-[var(--stellar)]'

/**
 * passphrase modal — rotate the passphrase used to return to PHENYX. Fields stay
 * local until "update passphrase" is pressed, which calls the change endpoint.
 */
export function PassphraseModal() {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleUpdate = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/auth/passphrase/change', {
        method: 'POST',
        body: JSON.stringify({
          currentPassphrase: current,
          newPassphrase: next,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('your passphrase has been updated.')
      setCurrent('')
      setNext('')
    } catch {
      setError('could not update your passphrase. please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="passphrase"
        subtitle="your passphrase is how you return to PHENYX. it is personal to you. do not share it."
      />
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#888]">current passphrase</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={fieldClassName}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#888]">new passphrase</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={fieldClassName}
          />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <GhostButton
          onClick={handleUpdate}
          disabled={saving || !current || !next}
          className="self-start"
        >
          {saving ? 'updating…' : 'update passphrase'}
        </GhostButton>
        {status && <StatusLine message={status} />}
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
