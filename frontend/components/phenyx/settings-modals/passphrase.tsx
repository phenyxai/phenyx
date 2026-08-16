'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import {
  GhostButton,
  ModalErr,
  ModalField,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'
import { passphraseChangeClientError } from './validation'

/**
 * passphrase modal — current, new, new again. Errors via ModalErr, never alert.
 */
export function PassphraseModal() {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [again, setAgain] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleUpdate = async () => {
    const clientError = passphraseChangeClientError(current, next, again)
    if (clientError) {
      setStatus('')
      setError(clientError)
      return
    }
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account/passphrase', {
        method: 'POST',
        body: JSON.stringify({
          currentPassphrase: current,
          newPassphrase: next,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error || 'could not update your passphrase. please try again.')
        return
      }
      setStatus('your passphrase has been updated.')
      setCurrent('')
      setNext('')
      setAgain('')
    } catch {
      setError('could not update your passphrase. please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="your passphrase"
        subtitle="your passphrase is how you return to PHENYX. it is personal to you. do not share it."
      />
      <div className="flex flex-col gap-4">
        <ModalField
          label="current passphrase"
          type="password"
          autoComplete="current-password"
          placeholder="enter your current passphrase"
          value={current}
          onChange={setCurrent}
        />
        <ModalField
          label="new passphrase"
          type="password"
          autoComplete="new-password"
          placeholder="a phrase or line that means something to you"
          value={next}
          onChange={setNext}
        />
        <ModalField
          label="new passphrase again"
          type="password"
          autoComplete="new-password"
          placeholder="type it once more"
          value={again}
          onChange={setAgain}
        />
      </div>
      <ModalErr message={error} />
      <div className="flex flex-col gap-3">
        <GhostButton onClick={handleUpdate} disabled={saving} className="self-start">
          {saving ? 'updating…' : 'update passphrase'}
        </GhostButton>
        {status && <StatusLine message={status} />}
      </div>
    </SettingsDialogContent>
  )
}
