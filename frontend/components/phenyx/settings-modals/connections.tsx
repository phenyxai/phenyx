'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import {
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/** Platforms PHENYX can read through Onairos. Labels render verbatim, lowercase. */
const ALL_PLATFORMS = [
  'instagram',
  'spotify',
  'youtube',
  'linkedin',
  'reddit',
] as const

type Platform = (typeof ALL_PLATFORMS)[number]

const rowClassName =
  'flex items-center justify-between gap-4 rounded-lg border border-[#1C1C1C] bg-[#0A0A0A] px-3 py-2.5'

/**
 * my connections modal — the connected-platform list (each with a disconnect
 * action) and the available-platform list (each with a connect action).
 * Connect/disconnect call the Onairos endpoints; the local lists update
 * optimistically and tolerate a not-yet-live backend.
 */
export function ConnectionsModal() {
  const [connected, setConnected] = React.useState<Platform[]>([])
  const [pending, setPending] = React.useState<Platform | null>(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await apiFetch('/onairos/connections')
        if (!res.ok) return
        const body = (await res.json()) as {
          connections?: { platform: string; status?: string }[]
        }
        if (!active) return
        const live = (body.connections ?? [])
          .filter((c) => c.status !== 'disconnected')
          .map((c) => c.platform)
          .filter((p): p is Platform =>
            (ALL_PLATFORMS as readonly string[]).includes(p),
          )
        setConnected(live)
      } catch {
        // backend not live yet — start from no connections.
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const available = ALL_PLATFORMS.filter((p) => !connected.includes(p))

  const connect = async (platform: Platform) => {
    setPending(platform)
    setError('')
    try {
      const res = await apiFetch('/onairos/connect', {
        method: 'POST',
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) throw new Error('failed')
      setConnected((prev) => [...prev, platform])
    } catch {
      setError(`could not connect ${platform}. please try again.`)
    } finally {
      setPending(null)
    }
  }

  const disconnect = async (platform: Platform) => {
    setPending(platform)
    setError('')
    try {
      const res = await apiFetch('/onairos/disconnect', {
        method: 'POST',
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) throw new Error('failed')
      setConnected((prev) => prev.filter((p) => p !== platform))
    } catch {
      setError(`could not disconnect ${platform}. please try again.`)
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="my connections"
        subtitle="connected platforms feed your constellation. disconnecting stops new data. previous patterns are retained."
      />

      <section aria-label="connected platforms" className="flex flex-col gap-2">
        <h3 className="text-[10px] tracking-[0.12em] text-[var(--stellar)] uppercase">
          connected
        </h3>
        {connected.length === 0 ? (
          <p className="text-xs text-[#555]">no platforms connected.</p>
        ) : (
          connected.map((platform) => (
            <div key={platform} className={rowClassName}>
              <span className="text-xs text-[#FFFDFD]">{platform}</span>
              <button
                type="button"
                onClick={() => disconnect(platform)}
                disabled={pending === platform}
                className="text-[11px] text-[#666] transition-colors hover:text-[#FFFDFD] disabled:opacity-50"
              >
                {pending === platform ? 'disconnecting…' : 'disconnect'}
              </button>
            </div>
          ))
        )}
      </section>

      <section aria-label="available platforms" className="flex flex-col gap-2">
        <h3 className="text-[10px] tracking-[0.12em] text-[#555] uppercase">
          available
        </h3>
        {available.length === 0 ? (
          <p className="text-xs text-[#555]">all platforms connected.</p>
        ) : (
          available.map((platform) => (
            <div key={platform} className={rowClassName}>
              <span className="text-xs text-[#aaa]">{platform}</span>
              <button
                type="button"
                onClick={() => connect(platform)}
                disabled={pending === platform}
                className="text-[11px] text-[var(--stellar)] transition-colors hover:text-[#FFFDFD] disabled:opacity-50"
              >
                {pending === platform ? 'connecting…' : 'connect'}
              </button>
            </div>
          ))
        )}
      </section>

      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
