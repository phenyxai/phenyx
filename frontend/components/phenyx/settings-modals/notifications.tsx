'use client'

import * as React from 'react'

import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import {
  GhostButton,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/**
 * Default toggle order + state is load-bearing: on / on / off / on, in exactly
 * this sequence. Do not reorder.
 */
const NOTIFICATION_DEFAULTS: { key: string; label: string; on: boolean }[] = [
  { key: 'new_observations', label: 'new observations', on: true },
  { key: 'weekly_constellation_update', label: 'weekly constellation update', on: true },
  { key: 'polaris_insights', label: 'polaris insights', on: false },
  { key: 'platform_connection_alerts', label: 'platform connection alerts', on: true },
]

/**
 * notifications modal — four toggles, local until "save". Closing without saving
 * discards changes.
 */
export function NotificationsModal() {
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_DEFAULTS.map((n) => [n.key, n.on])),
  )
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/me/notifications', {
        method: 'POST',
        body: JSON.stringify({ notification_prefs: prefs }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('your notification preferences have been saved.')
    } catch {
      setError('could not save your preferences. please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent aria-describedby={undefined}>
      <ModalHeading title="notifications" />
      <div className="flex flex-col gap-3">
        {NOTIFICATION_DEFAULTS.map(({ key, label }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between gap-4"
          >
            <span className="text-xs text-[#aaa]">{label}</span>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(checked) =>
                setPrefs((prev) => ({ ...prev, [key]: checked }))
              }
              className="data-[state=checked]:bg-[var(--stellar)]"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <GhostButton onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'saving…' : 'save'}
        </GhostButton>
        {status && <StatusLine message={status} />}
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
