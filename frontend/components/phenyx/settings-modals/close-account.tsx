'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  ModalErr,
  ModalField,
  ModalHeading,
  SettingsDialogContent,
  useSettingsModals,
} from './modal-host'
import { closeAccountClientError } from './validation'

/**
 * close your account — own screen with two gates: passphrase, then type
 * `delete my account`. Checks run in fill order. Never alert.
 */
export function CloseAccountModal() {
  const router = useRouter()
  const { openModal } = useSettingsModals()
  const [passphrase, setPassphrase] = React.useState('')
  const [phrase, setPhrase] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleDelete = async () => {
    const clientError = closeAccountClientError(passphrase, phrase)
    if (clientError) {
      setError(clientError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/account/close', {
        method: 'POST',
        body: JSON.stringify({
          passphrase,
          confirmation: phrase,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error || 'could not close the account. please try again.')
        return
      }
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setError('could not close the account. please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="close your account"
        subtitle="this is permanent. read it before you type anything."
      />

      <ul className="m-0 mb-3.5 list-none p-0">
        {[
          'your constellation, all seven points',
          'every observation, and the records behind them',
          'your whole polaris history',
          'your timeline, what has held, and what moved',
        ].map((item) => (
          <li
            key={item}
            className="relative py-1.5 pl-4 text-[12.5px] leading-snug text-[#FFFDFD]/70 before:absolute before:top-[13px] before:left-0 before:h-1 before:w-1 before:rounded-full before:bg-[#a06054]"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mb-4 text-[12.5px] leading-relaxed text-[#888]">
        all of it goes, and none of it comes back. if you want to keep any of
        it,{' '}
        <button
          type="button"
          onClick={() => openModal('data-management')}
          className="cursor-pointer border-0 border-b border-[rgba(var(--s-rgb),0.35)] bg-transparent p-0 font-inherit text-[rgba(var(--s-rgb),0.9)]"
        >
          export it first
        </button>
        .
      </p>

      <div className="flex flex-col gap-4">
        <ModalField
          label="your passphrase"
          type="password"
          autoComplete="current-password"
          placeholder="confirm it is you"
          value={passphrase}
          onChange={setPassphrase}
        />
        <ModalField
          label={
            <>
              type <b>delete my account</b> to confirm
            </>
          }
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="delete my account"
          value={phrase}
          onChange={setPhrase}
        />
      </div>

      <ModalErr message={error} />

      <button
        type="button"
        onClick={handleDelete}
        disabled={saving}
        className="mt-1.5 w-full rounded-md border border-[#5a2a2a] bg-transparent px-4 py-3 text-[11px] text-[#c97a6a] disabled:opacity-50"
      >
        {saving ? 'closing…' : 'delete my account'}
      </button>
      <button
        type="button"
        onClick={() => openModal('account')}
        className="mt-2 w-full rounded-md border border-[#282828] bg-transparent px-4 py-3 text-[11px] text-[#FFFDFD]/60"
      >
        keep my account
      </button>
    </SettingsDialogContent>
  )
}
