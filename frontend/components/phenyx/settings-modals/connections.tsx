'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import { OnairosButtonWrapper } from '@/components/onairos-button-wrapper'
import { clearOnairosClientToken } from '@/lib/onairos'
import { redactOnairosForProfile } from '@/lib/onairos-snapshot'
import {
  buildOnairosTraitObject,
  normalizeOnairosResult,
} from '@/lib/onairos-result'
import type { OnairosCompleteData } from 'onairos'
import {
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/** PHE-129: the list shows this many platforms, then "+ n more". */
const SHOWN = 5

/**
 * connections — the connected platforms five at a time, and a single Onairos
 * CTA. Add/remove happens through Onairos; there is no in-app pause or
 * disconnect.
 */
export function ConnectionsModal() {
  const [connected, setConnected] = React.useState<string[]>([])
  const [all, setAll] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    try {
      const res = await apiFetch('/onairos/connections')
      if (!res.ok) return
      const body = (await res.json()) as {
        connections?: { platform: string; status?: string }[]
      }
      setConnected(
        (body.connections ?? [])
          .filter((c) => c.status !== 'disconnected')
          .map((c) => c.platform)
          .filter(Boolean),
      )
    } catch {
      // backend not live yet
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleComplete = (result: OnairosCompleteData) => {
    const normalized = normalizeOnairosResult(result)
    const platforms = normalized.platforms
    const redacted = redactOnairosForProfile(buildOnairosTraitObject(normalized))
    if (platforms.length >= 1) {
      apiFetch('/onairos/connect', {
        method: 'POST',
        body: JSON.stringify({
          platforms,
          trait_object: redacted,
          token: (result as { token?: string }).token,
          trigger: 'platform_refresh',
        }),
      })
        .then(() => load())
        .catch(() => {
          setError('could not refresh connections. please try again.')
        })
    }
    clearOnairosClientToken()
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="connections"
        subtitle="these are the platforms that are part of your constellation. you can add or remove them through onairos."
      />

      <section aria-label="currently connected">
        {connected.length === 0 ? (
          <p className="text-[13px] text-ph-white/45">no platforms connected yet.</p>
        ) : (
          <ul className="flex flex-col">
            {(all ? connected : connected.slice(0, SHOWN)).map((platform) => (
              <li
                key={platform}
                className="flex items-center justify-between border-b border-ph-white/[0.06] py-2.5 text-[14px] lowercase text-ph-white/88"
              >
                {platform}
                <span className="text-[12px] text-[rgba(var(--ph-accent-rgb),0.9)]">connected</span>
              </li>
            ))}
          </ul>
        )}
        {!all && connected.length > SHOWN && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="mt-2.5 text-[13px] text-ph-white/60 transition-colors duration-200 hover:text-[var(--ph-accent)]"
          >
            + {connected.length - SHOWN} more
          </button>
        )}
      </section>

      <div className="mt-2">
        <OnairosButtonWrapper
          webpageName="PHENYX"
          requestedData={['personality']}
          buttonText="manage connections with onairos"
          onComplete={handleComplete}
        />
      </div>

      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
