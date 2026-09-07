'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch, type ProfileOverview } from '@/lib/api-client'
import { V67_PRICING } from '@/lib/billing'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { useTier } from '@/lib/use-tier'
import {
  ModalHeading,
  PrimaryButton,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/** What full includes (v244 prototype, subscription modal). */
const FULL_INCLUDED = [
  'every daily observation',
  'more polaris room each week',
  'a daily point to stay close to',
  'a weekly look at what shifted',
  'a yearly look across your timeline',
]

/**
 * What free includes. Reconciled with the upgrade modal's "free shows you what
 * is true" framing and the v243 gating (plan decision 13); the prototype's
 * "one daily observation" / "the evidence behind everything shown" are stale.
 */
const FREE_INCLUDED = [
  'every observation of the day',
  'your seven-point constellation',
  'three polaris questions each week',
  'the span of time behind each observation',
]

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

const MONTHLY = `$${V67_PRICING.monthly}`
const YEARLY = `$${V67_PRICING.yearly}`

type Billing = Pick<ProfileOverview, 'tier' | 'renews_at' | 'billing_period'>

/** "1 october 2026" (local time), or null for anything unparseable. */
export function formatRenewDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * subscription modal (PHE-95 / v244, settings > subscription). Plan name and
 * price, the renew line, what's included, and the one action the plan allows:
 * full monthly can switch to free through the Stripe billing portal; free can
 * upgrade through the same monthly checkout as the upgrade modal; yearly and
 * gifted have nothing to do here. Renders from live plan state via
 * `/profile/overview`, with `useTier` as the fallback when that read fails.
 */
export function SubscriptionModal() {
  const router = useRouter()
  const { isPro } = useTier()
  const [billing, setBilling] = React.useState<Billing | null>(null)
  const [ready, setReady] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await apiFetch('/profile/overview')
        if (res.ok) {
          const body = (await res.json()) as ProfileOverview
          if (active) {
            setBilling({
              tier: body.tier,
              renews_at: body.renews_at ?? null,
              billing_period: body.billing_period ?? null,
            })
          }
        }
      } catch {
        // fall through to the tier hook
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const full = billing ? billing.tier === 'pro' : isPro
  const period = billing?.billing_period ?? null
  const renewDate = formatRenewDate(billing?.renews_at)

  const planName = full ? 'full' : 'free'
  const price = !full
    ? 'free'
    : period === 'yearly'
      ? `${YEARLY} / year`
      : `${MONTHLY} / month`

  let renewLine: string
  if (!full) {
    renewLine = 'no billing on free'
  } else if (period === 'monthly') {
    renewLine = renewDate
      ? `renews ${renewDate} · or ${YEARLY}/year`
      : `renews monthly · or ${YEARLY}/year`
  } else if (period === 'yearly') {
    renewLine = 'paid for the year'
  } else {
    renewLine = 'no billing on this plan'
  }

  const included = full ? FULL_INCLUDED : FREE_INCLUDED

  const handleUpgrade = async () => {
    setBusy(true)
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
      setBusy(false)
    }
  }

  const handleSwitchToFree = async () => {
    setBusy(true)
    setError('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('sign in again to manage your subscription.')
        return
      }
      const res = await apiFetch('/stripe/billing-portal', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      })
      if (!res.ok) throw new Error('billing portal unavailable')
      const json = (await res.json()) as { url?: string }
      if (json.url) {
        window.location.href = json.url
        return
      }
      throw new Error('billing portal unavailable')
    } catch {
      setError('could not open subscription management. please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsDialogContent aria-describedby={undefined}>
      <ModalHeading title="your subscription" />

      {!ready ? (
        <div className="min-h-[240px]" aria-busy="true" />
      ) : (
        <div>
          <div className="mb-1 flex items-baseline gap-3">
            <span className="text-[22px] font-normal text-[#FFFDFD]">
              {planName}
            </span>
            <span className="text-[13px] text-[rgba(var(--stellar-rgb),0.9)]">
              {price}
            </span>
          </div>
          <p className="mb-[18px] text-[12px] text-[rgba(255,253,253,0.5)]">
            {renewLine}
          </p>

          <p className="mb-1.5 text-[10.5px] tracking-[0.14em] text-[rgba(255,253,253,0.44)] uppercase">
            what&apos;s included
          </p>
          <ul className="mb-[18px] flex flex-col">
            {included.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2.5 border-b border-[rgba(255,253,253,0.06)] py-2 text-[12.5px] leading-relaxed text-[rgba(255,253,253,0.68)]"
              >
                <span aria-hidden="true" className="shrink-0 text-[var(--stellar)]">
                  ✦
                </span>
                {line}
              </li>
            ))}
          </ul>

          {!full && (
            <>
              <PrimaryButton onClick={handleUpgrade} disabled={busy}>
                {busy ? 'loading…' : `upgrade to full · ${MONTHLY}/month`}
              </PrimaryButton>
              <p className="mt-2.5 text-center text-[11.5px] text-[rgba(255,253,253,0.5)]">
                or {YEARLY}/year. cancel any time.
              </p>
            </>
          )}

          {full && period === 'monthly' && (
            <>
              <button
                type="button"
                onClick={handleSwitchToFree}
                disabled={busy}
                className="w-full rounded-[10px] border border-[rgba(255,253,253,0.14)] bg-transparent px-6 py-3 text-xs text-[rgba(255,253,253,0.7)] transition-colors hover:border-[rgba(255,253,253,0.28)] hover:text-[#FFFDFD] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'loading…' : 'switch to free'}
              </button>
              <p className="mt-2.5 text-center text-[11.5px] text-[rgba(255,253,253,0.5)]">
                cancel any time. you keep full until the period ends.
              </p>
            </>
          )}

          {error && (
            <div className="mt-3">
              <StatusLine message={error} tone="error" />
            </div>
          )}
        </div>
      )}
    </SettingsDialogContent>
  )
}
