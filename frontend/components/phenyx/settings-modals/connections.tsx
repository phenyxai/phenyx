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

/**
 * my connections — currently connected tags and a single Onairos CTA.
 * Add/remove happens through Onairos; there is no in-app pause or disconnect.
 */
export function ConnectionsModal() {
  const [connected, setConnected] = React.useState<string[]>([])
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
        title="my connections"
        subtitle="connected platforms feed your constellation. manage every connection in one place through onairos."
      />

      <section aria-label="currently connected" className="flex flex-col gap-2">
        <p className="text-[9px] tracking-[0.14em] text-[#FFFDFD]/55 uppercase">
          currently connected
        </p>
        {connected.length === 0 ? (
          <p className="text-xs text-[#555]">no platforms connected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {connected.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-[#242424] bg-[#0d0d0d] px-3 py-1 text-[11px] lowercase text-[#FFFDFD]/70"
              >
                {platform}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mt-2">
        <OnairosButtonWrapper
          webpageName="PHENYX"
          requestedData={['personality']}
          buttonText="continue with onairos"
          onComplete={handleComplete}
        />
      </div>

      <p className="text-[11.5px] leading-relaxed text-[#FFFDFD]/50">
        add, remove, or manage any platform directly through onairos. your
        constellation retains the patterns already observed.
      </p>

      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
