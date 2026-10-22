'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch, type ProfileOverview } from '@/lib/api-client'
import { V67_PRICING } from '@/lib/billing'
import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import { useTier } from '@/lib/use-tier'
import {
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

type PlanId = 'free' | 'monthly' | 'yearly'

/** PHE-129: three cards in the company overview's terms (section 17). */
const PLANS: { id: PlanId; name: string; price: string; per: string; lines: string[] }[] = [
  {
    id: 'free',
    name: 'free',
    price: '$0',
    per: '',
    lines: [
      'every point and moment, with what happened and its sources',
      'the whole insights page',
      `${V67_PRICING.weeklyDiscoveries.free} new discovery a week`,
      `${V67_PRICING.polarisMonthlyPoints.free} polaris points a month and past conversations`,
    ],
  },
  {
    id: 'monthly',
    name: 'full',
    price: `$${V67_PRICING.monthly}`,
    per: 'a month',
    lines: [
      'why each moment matters and what it connects to',
      `${V67_PRICING.weeklyDiscoveries.full} new discoveries a week`,
      `${V67_PRICING.polarisMonthlyPoints.full} polaris points a month`,
      'questions to return to',
    ],
  },
  {
    id: 'yearly',
    name: 'full · annual',
    price: `$${V67_PRICING.yearly.toFixed(2)}`,
    per: 'a year',
    lines: ['everything in full', 'billed once a year', `${V67_PRICING.annualDiscountPercent}% off`],
  },
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

type Billing = Pick<ProfileOverview, 'tier' | 'renews_at' | 'billing_period'>

/** "1 october 2026" (local time), or null for anything unparseable. */
export function formatRenewDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * plan & billing (PHE-95 / v244, PHE-129, settings > membership). Three cards,
 * free, full and full annual, with the current one marked and the moves the
 * plan allows: free can choose full monthly or annual through Stripe
 * checkout; full monthly can switch to free through the Stripe billing
 * portal; yearly and gifted have nothing to do here. Renders from live plan
 * state via `/profile/overview`, with `useTier` as the fallback when that
 * read fails.
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

  const current: PlanId = !full ? 'free' : period === 'yearly' ? 'yearly' : 'monthly'
  // The one move each card offers from the current plan, if any.
  const action = (id: PlanId): (() => void) | null => {
    if (id === current) return null
    if (current === 'free') return () => handleCheckout(id === 'yearly' ? 'yearly' : 'monthly')
    if (current === 'monthly' && period === 'monthly' && id === 'free') return handleSwitchToFree
    return null
  }

  const handleCheckout = async (billingPeriod: 'monthly' | 'yearly') => {
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
          billingPeriod,
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
    <SettingsDialogContent aria-describedby={undefined} className="w-[min(820px,calc(100vw-40px))]">
      <ModalHeading title="plan & billing" />

      {!ready ? (
        <div className="min-h-[240px]" aria-busy="true" />
      ) : (
        <div>
          <div className="grid gap-3 [@media(max-width:640px)]:grid-cols-1 [@media(min-width:641px)]:grid-cols-3">
            {PLANS.map((plan) => {
              const on = plan.id === current
              const move = action(plan.id)
              return (
                <section
                  key={plan.id}
                  aria-label={plan.name}
                  className={`flex flex-col rounded-2xl border bg-ph-white/[0.02] p-5 ${
                    on ? 'border-[rgba(var(--ph-accent-rgb),0.5)]' : 'border-ph-white/10'
                  }`}
                >
                  <p className="text-[14.5px] text-ph-white/92">{plan.name}</p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="text-[26px] font-light text-ph-white">{plan.price}</span>
                    {plan.per && <span className="text-[12px] text-ph-white/55">{plan.per}</span>}
                  </p>
                  <ul className="mt-3 mb-5 flex flex-col gap-2">
                    {plan.lines.map((line) => (
                      <li key={line} className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-ph-white/72">
                        <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--ph-accent)]" />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {on ? (
                      <p className="py-2 text-center text-[13px] text-[var(--ph-accent)]">
                        {plan.id === 'monthly' && renewDate ? `current plan · renews ${renewDate}` : 'current plan'}
                      </p>
                    ) : move ? (
                      <button
                        type="button"
                        onClick={move}
                        disabled={busy}
                        className="h-[42px] w-full rounded-full border border-ph-white/24 text-[13px] text-ph-white/85 transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)] disabled:opacity-50"
                      >
                        {busy ? 'loading…' : 'choose'}
                      </button>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </div>

          <p className="mt-4 text-center text-[12px] text-ph-white/50">
            payments run through stripe. cancel any time.
          </p>

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
