'use client'

import * as React from 'react'

import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import {
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/**
 * Default toggle order + state is load-bearing: on / on / off / on, in exactly
 * this sequence. Do not reorder. polaris observations is off; the rest are on.
 */
const NOTIFICATION_DEFAULTS: { key: string; label: string; on: boolean }[] = [
  { key: 'new_observations', label: 'new observations', on: true },
  { key: 'weekly_constellation_update', label: 'weekly constellation update', on: true },
  { key: 'polaris_observations', label: 'polaris observations', on: false },
  { key: 'platform_connection_alerts', label: 'platform connection alerts', on: true },
]

/**
 * notifications modal — four toggles persist on change. Closing does not
 * discard a toggle that already saved.
 */
export function NotificationsModal() {
  const [prefs, setPrefs] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_DEFAULTS.map((n) => [n.key, n.on])),
  )
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await apiFetch('/profile/notifications')
        if (!res.ok) return
        const body = (await res.json()) as {
          notification_prefs?: Record<string, boolean>
        }
        if (!active || !body.notification_prefs) return
        setPrefs((prev) => ({ ...prev, ...body.notification_prefs }))
      } catch {
        // defaults already applied
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const persist = async (next: Record<string, boolean>) => {
    setError('')
    try {
      const res = await apiFetch('/profile/notifications', {
        method: 'POST',
        body: JSON.stringify({ notification_prefs: next }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setError('could not save your preferences. please try again.')
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="notifications"
        subtitle="choose what PHENYX can surface to you."
      />
      <div className="flex flex-col gap-3">
        {NOTIFICATION_DEFAULTS.map(({ key, label }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between gap-4"
          >
            <span className="text-xs text-[#aaa]">{label}</span>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(checked) => {
                const next = { ...prefs, [key]: checked }
                setPrefs(next)
                void persist(next)
              }}
              className="data-[state=checked]:bg-[var(--stellar)]"
            />
          </label>
        ))}
      </div>
      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
