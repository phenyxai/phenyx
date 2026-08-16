'use client'

import * as React from 'react'

import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api-client'
import {
  GhostButton,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

const STARS = [1, 2, 3, 4, 5] as const

/**
 * feedback modal — a 1–5 star rating and a free-text field. Both stay local
 * until "send feedback", which posts to the feedback endpoint.
 */
export function FeedbackModal() {
  const [rating, setRating] = React.useState(0)
  const [message, setMessage] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSubmit = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating, message }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('thank you. your feedback has been sent.')
      setRating(0)
      setMessage('')
    } catch {
      setError('could not send your feedback. please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="share feedback"
        subtitle="your feedback directly shapes how PHENYX develops. tell us what is working, what is not, and what you want to see."
      />

      <div
        role="radiogroup"
        aria-label="rating"
        className="flex items-center gap-2"
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            onClick={() => setRating(star)}
            className="text-2xl leading-none transition-colors"
            style={{ color: star <= rating ? 'var(--stellar)' : '#333' }}
          >
            {star <= rating ? '★' : '☆'}
          </button>
        ))}
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="what would you like to tell us?"
        className="min-h-24 border-[#222] bg-[#111] text-[13px] text-[#FFFDFD] placeholder:text-[#555] focus-visible:border-[var(--stellar)] focus-visible:ring-0"
      />

      <div className="flex flex-col gap-3">
        <GhostButton
          onClick={handleSubmit}
          disabled={saving || (rating === 0 && message.trim() === '')}
          className="self-start"
        >
          {saving ? 'sending…' : 'send feedback'}
        </GhostButton>
        {status && <StatusLine message={status} />}
        {error && <StatusLine message={error} tone="error" />}
      </div>
    </SettingsDialogContent>
  )
}
