'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { nameFromMetadata } from '@/app/dashboard/insights/stats'
import {
  ModalErr,
  ModalField,
  ModalHeading,
  PrimaryButton,
  SettingsDialogContent,
  useSettingsModals,
} from './modal-host'

/**
 * edit profile — the name shown across the constellation and insights, and
 * the sign-in email as plain text under it (PHE-163: the email is read-only,
 * so there is no code to confirm). The name starts as the one PHENYX shows,
 * else the one the Google profile carries (PHE-148).
 */
export function EditProfileModal() {
  const { closeModal } = useSettingsModals()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [google, setGoogle] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setGoogle(user?.app_metadata?.provider === 'google')
      setEmail(user?.email ?? '')
      setName(nameFromMetadata(user?.user_metadata))
      try {
        const res = await apiFetch('/profile/overview')
        if (!res.ok) return
        const body = (await res.json()) as { display_name?: string | null; email?: string | null }
        if (!active) return
        if (body.display_name?.trim()) setName(body.display_name.trim())
        if (body.email) setEmail(body.email)
      } catch {
        // The session's own name and email stand.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('add the name you want to see.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/profile/identity', {
        method: 'POST',
        body: JSON.stringify({ display_name: name }),
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
        subtitle="choose the name you want to see across your constellation and insights."
      />
      <div className="flex flex-col gap-5">
        <ModalField
          label="name"
          type="text"
          autoComplete="name"
          placeholder="your name"
          value={name}
          onChange={setName}
        />
        {email && (
          <div className="flex flex-col gap-2">
            <span className="text-meta text-ph-secondary">email</span>
            <div>
              <p className="text-reading break-all text-ph-white">{email}</p>
              <p className="text-meta text-ph-tertiary">
                {google ? 'you signed in with google' : 'you signed in with your email'}
              </p>
            </div>
          </div>
        )}
      </div>
      <ModalErr message={error} />
      <PrimaryButton onClick={handleSave} disabled={saving}>
        {saving ? 'saving…' : 'save changes'}
      </PrimaryButton>
    </SettingsDialogContent>
  )
}
