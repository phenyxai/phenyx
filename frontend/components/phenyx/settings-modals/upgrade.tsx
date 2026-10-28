'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api-client'
import { V67_PRICING } from '@/lib/billing'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  ModalHeading,
  PrimaryButton,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/** What full adds (company overview, section 17; PHE-129). */
const FEATURES = [
  'why each moment matters and what it connects to',
  `${V67_PRICING.polarisMonthlyPoints.full} polaris points a month`,
  'questions to return to that polaris keeps for you',
  'early access to new features',
]

/**
 * upgrade modal: what full opens, and the checkout CTA. In-app CTAs hide this
 * from full accounts upstream (PHE-21/26/30); it still renders correctly if
 * opened directly. The CTA starts a monthly Stripe checkout. `pro` is the
 * DB/enum value for the plan; the person only ever reads "full".
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
      <ModalHeading title="what full opens" />
      <p className="mb-4 text-[12.5px] leading-relaxed text-ph-white/55">
        free shows you what is true. every observation of the day, and all
        seven points of your constellation. full is how you find out why it is
        true, what it means, and what to do about it.
      </p>

      <ul className="flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <span aria-hidden="true" className="text-[var(--ph-accent)]">
              ✦
            </span>
            <span className="text-xs leading-relaxed text-ph-white/80">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={handleUpgrade} disabled={loading}>
          {loading ? 'loading…' : 'continue with full, $12.99/month'}
        </PrimaryButton>
        <p className="text-center text-[11.5px] text-ph-white/55">
          or ${V67_PRICING.yearly.toFixed(2)}/year, {V67_PRICING.annualDiscountPercent}% off. cancel any time.
        </p>
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
