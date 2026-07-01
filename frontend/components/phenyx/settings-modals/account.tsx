'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  DangerConfirm,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

const rowButtonClassName =
  'w-full rounded-lg border border-[#1C1C1C] bg-[#0A0A0A] px-4 py-3 text-left text-xs text-[#aaa] transition-colors hover:border-[#333] hover:text-[#FFFDFD] disabled:cursor-not-allowed disabled:opacity-50'

const dangerRowClassName =
  'w-full rounded-lg border border-[#3a1010] bg-transparent px-4 py-3 text-left text-xs text-[#6a2020] transition-colors hover:bg-[#3a1010] hover:text-[#FFFDFD] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * account modal — log out (immediate), plus freeze and delete which each sit
 * behind an explicit danger confirm step before the backend job runs.
 */
export function AccountModal() {
  const router = useRouter()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleFreeze = async () => {
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account/freeze', { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      setStatus('your account is frozen. data reading is paused.')
    } catch {
      setError('could not freeze your account. please try again.')
    }
  }

  const handleDelete = async () => {
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) throw new Error('failed')
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setError('could not delete your account. please try again.')
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading title="account" subtitle="manage your account status." />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLogout}
          className={rowButtonClassName}
        >
          log out
        </button>

        <DangerConfirm
          title="freeze account?"
          description="this pauses all data reading. your constellation and observations are retained and remain readable. you can unfreeze at any time."
          confirmLabel="freeze account"
          cancelLabel="keep active"
          onConfirm={handleFreeze}
        >
          <button type="button" className={dangerRowClassName}>
            freeze account, pause all data reading
          </button>
        </DangerConfirm>

        <DangerConfirm
          title="delete account and all data?"
          description="this permanently removes your account, your constellation, and every observation. this cannot be undone."
          confirmLabel="delete everything"
          cancelLabel="keep my account"
          onConfirm={handleDelete}
        >
          <button type="button" className={dangerRowClassName}>
            delete account and all data
          </button>
        </DangerConfirm>
      </div>

      {status && <StatusLine message={status} />}
      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
