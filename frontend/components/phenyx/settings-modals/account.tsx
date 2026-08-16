'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { supabaseBrowser as supabase } from '@/lib/supabase-browser'
import {
  ModalHeading,
  SettingsDialogContent,
  useSettingsModals,
} from './modal-host'

const rowButtonClassName =
  'w-full rounded-lg border border-[#282828] bg-transparent px-4 py-3 text-left text-[11px] text-[#ccc] transition-colors hover:border-[#333] hover:text-[#FFFDFD]'

const dangerRowClassName =
  'w-full rounded-lg border border-[#5a2a2a] bg-transparent px-4 py-3 text-left text-[11px] text-[#c97a6a] transition-colors hover:bg-[#3a1010] hover:text-[#FFFDFD]'

/**
 * account — sign out keeps everything as it is. closing opens the two-gate
 * close-account screen. There is no pause or freeze.
 */
export function AccountModal() {
  const router = useRouter()
  const { openModal } = useSettingsModals()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <SettingsDialogContent>
      <ModalHeading
        title="account"
        subtitle="signing out keeps everything as it is. closing the account does not."
      />

      <button type="button" onClick={handleLogout} className={rowButtonClassName}>
        sign out
      </button>

      <div className="mt-6 border-t border-[#1c1414] pt-4">
        <p className="mb-2 text-[11.5px] font-semibold tracking-[0.12em] text-[#a06054] uppercase">
          closing your account
        </p>
        <p className="mb-3 text-[11.5px] leading-relaxed text-[#FFFDFD]/55">
          this removes your constellation, every observation, and your polaris
          history. it cannot be undone, so export first if you want to keep any
          of it.
        </p>
        <button
          type="button"
          onClick={() => openModal('close-account')}
          className={dangerRowClassName}
        >
          close my account
        </button>
      </div>
    </SettingsDialogContent>
  )
}
