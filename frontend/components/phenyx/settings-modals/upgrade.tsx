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

/** Verbatim pro feature lines from v67 (`phenyx_product_v67.html` MODAL_CONTENT.pro). */
const FEATURES = [
  'every observation traced to the individual entries behind it, with dates and sources',
  'the reading underneath an observation, and what it rests on',
  'polaris: ask about any observation, grounded in your own signals',
  'a weekly synthesis of how your constellation moved',
  'your yearly recap, built from every week',
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
      <ModalHeading title="phenyx pro" />
      <p className="mb-4 text-[12.5px] leading-relaxed text-[#888]">
        the full observation layer on top of your constellation.
      </p>

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
          {loading ? 'loading…' : 'go pro, $12.99/month'}
        </PrimaryButton>
        <p className="text-center text-[11.5px] text-[#888]">
          or $99/year. your first month is free. cancel any time.
        </p>
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
