'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import { ModalErr, ModalField } from './modal-host'

/** Matches the sign-in screen's resend cooldown. */
const RESEND_AFTER_MS = 30000

/**
 * PHE-97 — "confirm it is you" without a passphrase. Sends a one-time code to
 * the email on the account (POST /account/confirm-code) and collects it. The
 * parent modal sends the code with its request (close account, edit profile).
 */
export function ConfirmCodeField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  // Number of codes sent; each send re-arms the resend timer.
  const [sends, setSends] = React.useState(0)
  const [sending, setSending] = React.useState(false)
  const [canResend, setCanResend] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (sends === 0) return
    setCanResend(false)
    const timer = setTimeout(() => setCanResend(true), RESEND_AFTER_MS)
    return () => clearTimeout(timer)
  }, [sends])

  const send = async () => {
    setSending(true)
    setError('')
    try {
      const res = await apiFetch('/account/confirm-code', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error || 'could not send a code. please try again.')
        return
      }
      setSends((n) => n + 1)
    } catch {
      setError('could not send a code. please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ModalField
        label="code from your email"
        type="text"
        autoComplete="one-time-code"
        placeholder="confirm it is you"
        value={value}
        onChange={(next) => onChange(next.replace(/\D/g, '').slice(0, 6))}
      />
      <p aria-live="polite" className="text-[11.5px] leading-normal text-[#FFFDFD]/50">
        {sends > 0 ? (
          canResend ? (
            <>
              didn’t get it?{' '}
              <SendLink onClick={send} disabled={sending}>
                resend code
              </SendLink>
            </>
          ) : (
            'we sent a code to your email.'
          )
        ) : (
          <SendLink onClick={send} disabled={sending}>
            {sending ? 'sending…' : 'send a code to your email'}
          </SendLink>
        )}
      </p>
      <ModalErr message={error} />
    </div>
  )
}

function SendLink(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="cursor-pointer border-0 border-b border-[rgba(var(--s-rgb),0.35)] bg-transparent p-0 font-inherit text-[rgba(var(--s-rgb),0.9)] disabled:opacity-50"
      {...props}
    />
  )
}
