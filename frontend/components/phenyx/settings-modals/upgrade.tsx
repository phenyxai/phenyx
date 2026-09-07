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

/** Verbatim from the v244 prototype (`MODAL_CONTENT.pro`, PHE-92). */
const FEATURES = [
  'where every observation came from, traced back to the day it happened',
  'what sits under it, set against what you say about yourself',
  'your seven points read together rather than one at a time',
  'polaris, to ask about any of it in your own words',
  'a weekly look at what shifted, and a yearly look back',
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
      <p className="mb-4 text-[12.5px] leading-relaxed text-[#888]">
        free shows you what is true. every observation of the day, and all
        seven points of your constellation. full is how you find out why it is
        true, what it means, and what to do about it.
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
          {loading ? 'loading…' : 'continue with full, $12.99/month'}
        </PrimaryButton>
        <p className="text-center text-[11.5px] text-[#888]">
          or $99/year. cancel any time.
        </p>
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
