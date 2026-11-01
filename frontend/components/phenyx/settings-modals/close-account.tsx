'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  DangerButton,
  GhostButton,
  ModalErr,
  ModalField,
  ModalHeading,
  SettingsDialogContent,
  useSettingsModals,
} from './modal-host'
import { closeAccountClientError } from './validation'

/**
 * close your account — one screen (PHE-163): what goes, a way to export it
 * first, then type `delete my account` and delete. The signed-in session is
 * the other gate; there is no emailed code. Never alert.
 */
export function CloseAccountModal() {
  const router = useRouter()
  const { openModal, closeModal } = useSettingsModals()
  const [phrase, setPhrase] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleDelete = async () => {
    const clientError = closeAccountClientError(phrase)
    if (clientError) {
      setError(clientError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/account/close', {
        method: 'POST',
        body: JSON.stringify({ confirmation: phrase }),
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
        subtitle="this can’t be undone, so read it through first."
      />

      <ul className="m-0 list-none p-0">
        {[
          'your constellation, all seven points',
          'every observation, and what sits behind each one',
          'your whole polaris history',
          'your timeline, what has held, and what moved',
        ].map((item) => (
          <li
            key={item}
            className="relative py-1 pl-[22px] text-reading text-ph-white before:absolute before:top-[15px] before:left-0 before:h-1 before:w-1 before:rounded-full before:bg-ph-red"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="text-body text-ph-secondary">
        all of it goes, and none of it comes back. if you want to keep any of
        it,{' '}
        <button
          type="button"
          onClick={() => openModal('data-management')}
          className="cursor-pointer border-0 border-b border-[rgba(var(--ph-accent-rgb),0.5)] bg-transparent p-0 font-inherit text-[var(--ph-accent)]"
        >
          export it first
        </button>
        .
      </p>

      <ModalField
        label={
          <>
            type <b className="font-semibold text-ph-white">delete my account</b> to confirm
          </>
        }
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="delete my account"
        value={phrase}
        onChange={setPhrase}
      />

      <ModalErr message={error} />

      <div className="flex flex-col gap-3">
        <DangerButton onClick={handleDelete} disabled={saving} className="w-full">
          {saving ? 'closing…' : 'delete my account'}
        </DangerButton>
        <GhostButton onClick={closeModal} className="w-full border-ph-white/[0.14] text-ph-white">
          keep my account
        </GhostButton>
      </div>
    </SettingsDialogContent>
  )
}
