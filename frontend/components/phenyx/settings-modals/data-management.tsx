'use client'

import * as React from 'react'

import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api-client'
import {
  DangerButton,
  DangerConfirm,
  GhostButton,
  ModalHeading,
  SettingsDialogContent,
  StatusLine,
} from './modal-host'

/**
 * data management modal — behavioural-reading + cross-platform-correlation
 * toggles (local until save), an export action, and a danger action to delete
 * constellation data behind an explicit confirm step.
 */
export function DataManagementModal() {
  const [behavioralReading, setBehavioralReading] = React.useState(true)
  const [crossPlatform, setCrossPlatform] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/me/data-preferences', {
        method: 'POST',
        body: JSON.stringify({
          behavioral_reading: behavioralReading,
          cross_platform_correlation: crossPlatform,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('your data preferences have been saved.')
    } catch {
      setError('could not save your preferences. please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account/export')
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'phenyx-data.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setStatus('your data export has started downloading.')
    } catch {
      setError('could not export your data. please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteConstellationData = async () => {
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account/constellation', { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      setStatus('your constellation data is being deleted.')
    } catch {
      setError('could not delete your constellation data. please try again.')
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="data management"
        subtitle="your data belongs to you. what onairos reads is processed and discarded. we never store raw platform data."
      />

      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-xs text-[#aaa]">behavioral reading</span>
          <Switch
            checked={behavioralReading}
            onCheckedChange={setBehavioralReading}
            className="data-[state=checked]:bg-[var(--stellar)]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-xs text-[#aaa]">cross-platform correlation</span>
          <Switch
            checked={crossPlatform}
            onCheckedChange={setCrossPlatform}
            className="data-[state=checked]:bg-[var(--stellar)]"
          />
        </label>
        <GhostButton onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'saving…' : 'save'}
        </GhostButton>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#1C1C1C] pt-4">
        <GhostButton
          onClick={handleExport}
          disabled={exporting}
          className="self-start"
        >
          {exporting ? 'preparing…' : 'export my data'}
        </GhostButton>
        <p className="text-[11px] leading-relaxed text-[#555]">
          download a portable copy of everything phenyx has observed for you.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#1C1C1C] pt-4">
        <DangerConfirm
          title="delete my constellation data?"
          description="this permanently removes your observations and synthesized patterns. your account remains. this cannot be undone."
          confirmLabel="delete constellation data"
          cancelLabel="keep my data"
          onConfirm={handleDeleteConstellationData}
        >
          <DangerButton className="self-start">
            delete my constellation data
          </DangerButton>
        </DangerConfirm>
      </div>

      {status && <StatusLine message={status} />}
      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
