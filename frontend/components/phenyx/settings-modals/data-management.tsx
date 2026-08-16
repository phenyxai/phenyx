'use client'

import * as React from 'react'

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
 * your data — export or delete the constellation. The title is the only
 * allowed "data" UI string. No pause/freeze toggles.
 */
export function DataManagementModal() {
  const [exporting, setExporting] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

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
      link.download = 'phenyx-export.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setStatus('your export has started downloading.')
    } catch {
      setError('could not export. please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteConstellation = async () => {
    setStatus('')
    setError('')
    try {
      const res = await apiFetch('/account/constellation', { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      setStatus('your constellation is being removed.')
    } catch {
      setError('could not remove your constellation. please try again.')
    }
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="your data"
        subtitle="everything PHENYX has observed belongs to you. raw signals are never stored."
      />

      <div>
        <p className="mb-2 text-[11px] text-[#FFFDFD]/85">take it with you</p>
        <p className="mb-3.5 text-[11.5px] leading-relaxed text-[#FFFDFD]/60">
          your constellation, observations and polaris history, in a portable format.
        </p>
        <GhostButton
          onClick={handleExport}
          disabled={exporting}
          className="self-start border-[#282828] text-[#ccc]"
        >
          {exporting ? 'preparing…' : 'export everything'}
        </GhostButton>
      </div>

      <div className="mt-2 border-t border-[#1c1414] pt-4">
        <p className="mb-3 text-[11.5px] font-semibold tracking-[0.12em] text-[#a06054] uppercase">
          danger zone
        </p>
        <DangerConfirm
          title="delete my constellation?"
          description="this permanently removes your observations and synthesized patterns. your account remains. this cannot be undone."
          confirmLabel="delete my constellation"
          cancelLabel="keep my constellation"
          onConfirm={handleDeleteConstellation}
        >
          <DangerButton className="self-start">delete my constellation</DangerButton>
        </DangerConfirm>
      </div>

      {status && <StatusLine message={status} />}
      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
