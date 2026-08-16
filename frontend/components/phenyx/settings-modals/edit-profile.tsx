'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  GhostButton,
  ModalErr,
  ModalField,
  ModalHeading,
  SettingsDialogContent,
  useSettingsModals,
} from './modal-host'
import { profileEditClientError } from './validation'

/**
 * edit profile — name and email, confirmed with the current passphrase.
 */
export function EditProfileModal() {
  const { closeModal } = useSettingsModals()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [passphrase, setPassphrase] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await apiFetch('/profile/overview')
        if (!res.ok) return
        const body = (await res.json()) as {
          display_name?: string | null
          email?: string | null
        }
        if (!active) return
        setName(body.display_name ?? '')
        setEmail(body.email ?? '')
      } catch {
        const { data: { user } } = await supabase.auth.getUser()
        if (!active) return
        if (user?.email) setEmail(user.email)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSave = async () => {
    const clientError = profileEditClientError(passphrase)
    if (clientError) {
      setError(clientError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/profile/identity', {
        method: 'POST',
        body: JSON.stringify({
          display_name: name,
          email,
          passphrase,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error || 'could not save the change.')
        return
      }
      closeModal()
    } catch {
      setError('could not save the change.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="edit profile"
        subtitle="update how your name and email appear across PHENYX."
      />
      <div className="flex flex-col gap-4">
        <ModalField
          label="name"
          type="text"
          autoComplete="name"
          placeholder="your name"
          value={name}
          onChange={setName}
        />
        <ModalField
          label="email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={setEmail}
        />
        <ModalField
          label="your passphrase"
          type="password"
          autoComplete="current-password"
          placeholder="confirm it is you"
          value={passphrase}
          onChange={setPassphrase}
        />
      </div>
      <ModalErr message={error} />
      <GhostButton onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'saving…' : 'save changes'}
      </GhostButton>
    </SettingsDialogContent>
  )
}
