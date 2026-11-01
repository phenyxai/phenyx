'use client'

import * as React from 'react'

import { apiFetch } from '@/lib/api-client'
import { GhostButton, ModalHeading, SettingsDialogContent, StatusLine } from './modal-host'

/**
 * your data — export only (PHE-163). Deleting happens only by closing the
 * account. The title is the only allowed "data" UI string. No pause/freeze
 * toggles.
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

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="your data"
        subtitle="everything observed about you belongs to you, and the raw signals are never kept."
      />

      <div className="flex flex-col items-start gap-2">
        <p className="text-item text-ph-white">take it with you</p>
        <p className="text-body text-ph-secondary">
          download your constellation, observations and polaris history in a format you can open anywhere.
        </p>
        <GhostButton
          onClick={handleExport}
          disabled={exporting}
          className="mt-2 border-ph-white/[0.14] text-ph-white"
        >
          {exporting ? 'preparing…' : 'export everything'}
        </GhostButton>
      </div>

      {status && <StatusLine message={status} />}
      {error && <StatusLine message={error} tone="error" />}
    </SettingsDialogContent>
  )
}
