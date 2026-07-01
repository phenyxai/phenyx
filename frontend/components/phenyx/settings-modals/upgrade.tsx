'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  ModalHeading,
  PrimaryButton,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/** Verbatim pro feature lines, each prefixed with ✦ (literal … preserved). */
const FEATURES = [
  'all observations, not just the first',
  'cross-platform citations…',
  'polaris with 8000 tokens a week, not 80',
  'constellation tracking over time',
  'full data provenance',
]

/**
 * upgrade modal — the pro value proposition and checkout CTA. In-app CTAs hide
 * this from pro/gifted users upstream (PHE-21/26/30); it still renders correctly
 * if opened directly. The CTA starts a monthly pro Stripe checkout.
 */
export function UpgradeModal() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleUpgrade = async () => {
    setLoading(true)
    setError('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/signin')
        return
      }
      const res = await apiFetch('/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({
          checkoutKind: 'pro',
          billingPeriod: 'monthly',
          userId: user.id,
        }),
      })
      if (!res.ok) throw new Error('failed')
      const { url } = (await res.json()) as { url?: string | null }
      if (url) {
        window.location.assign(url)
        return
      }
      setError('checkout could not be started. please try again.')
    } catch {
      setError('something went wrong. please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsDialogContent aria-describedby={undefined}>
      <ModalHeading title="upgrade to pro" />

      <ul className="flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <span aria-hidden="true" className="text-[var(--stellar)]">
              ✦
            </span>
            <span className="text-xs leading-relaxed text-[#ccc]">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={handleUpgrade} disabled={loading}>
          {loading ? 'loading…' : 'upgrade to pro, $20/month'}
        </PrimaryButton>
        <p className="text-center text-[11px] text-[#555]">cancel any time.</p>
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
