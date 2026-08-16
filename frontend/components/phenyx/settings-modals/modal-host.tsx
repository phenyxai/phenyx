'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

import { PassphraseModal } from './passphrase'
import { NotificationsModal } from './notifications'
import { ConnectionsModal } from './connections'
import { DataManagementModal } from './data-management'
import { AccountModal } from './account'
import { CloseAccountModal } from './close-account'
import { EditProfileModal } from './edit-profile'
import { FeedbackModal } from './feedback'
import { UpgradeModal } from './upgrade'

// ---------------------------------------------------------------------------
// Settings & Account modal host (PHE-32).
//
// A single Dialog portal opens any one of the seven settings modals by id.
// Radix Dialog gives us the focus trap, `esc` / overlay-click close, and focus
// return to the trigger for free. Consumers wrap their tree in
// `SettingsModalsProvider` and call `useSettingsModals().openModal(id)` from any
// settings row, GET IN TOUCH action, or upgrade CTA.
// ---------------------------------------------------------------------------

export type SettingsModalId =
  | 'passphrase'
  | 'notifications'
  | 'my-connections'
  | 'data-management'
  | 'account'
  | 'close-account'
  | 'edit-profile'
  | 'feedback'
  | 'upgrade'

const STELLAR_DEFAULT = '#5599FF'

interface SettingsModalsContextValue {
  /** The currently open modal id, or null when nothing is open. */
  openId: SettingsModalId | null
  /** Open a modal by id. The triggering element regains focus on close. */
  openModal: (id: SettingsModalId) => void
  /** Close whatever modal is open. */
  closeModal: () => void
  /** The user's stellar accent colour, used across every modal. */
  stellarColor: string
}

const SettingsModalsContext =
  React.createContext<SettingsModalsContextValue | null>(null)

/**
 * Provides the modal host + opener to its subtree. Render this once near the
 * root of any signed-in surface (the dashboard shell). Children call
 * `useSettingsModals()` to open modals by id.
 */
export function SettingsModalsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [openId, setOpenId] = React.useState<SettingsModalId | null>(null)
  const [stellarColor, setStellarColor] = React.useState(STELLAR_DEFAULT)

  React.useEffect(() => {
    const stored = localStorage.getItem('phenyx_stellar_color')
    if (stored) setStellarColor(stored)
  }, [])

  const openModal = React.useCallback((id: SettingsModalId) => setOpenId(id), [])
  const closeModal = React.useCallback(() => setOpenId(null), [])

  const value = React.useMemo<SettingsModalsContextValue>(
    () => ({ openId, openModal, closeModal, stellarColor }),
    [openId, openModal, closeModal, stellarColor],
  )

  return (
    <SettingsModalsContext.Provider value={value}>
      {children}
      <Dialog
        open={openId !== null}
        onOpenChange={(next) => {
          if (!next) closeModal()
        }}
      >
        {openId === 'passphrase' && <PassphraseModal />}
        {openId === 'notifications' && <NotificationsModal />}
        {openId === 'my-connections' && <ConnectionsModal />}
        {openId === 'data-management' && <DataManagementModal />}
        {openId === 'account' && <AccountModal />}
        {openId === 'close-account' && <CloseAccountModal />}
        {openId === 'edit-profile' && <EditProfileModal />}
        {openId === 'feedback' && <FeedbackModal />}
        {openId === 'upgrade' && <UpgradeModal />}
      </Dialog>
    </SettingsModalsContext.Provider>
  )
}

/** Access the modal opener/closer + stellar colour from any descendant. */
export function useSettingsModals(): SettingsModalsContextValue {
  const ctx = React.useContext(SettingsModalsContext)
  if (!ctx) {
    throw new Error(
      'useSettingsModals must be used within a <SettingsModalsProvider>',
    )
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Shared, PHENYX-styled building blocks for the individual modals. These mirror
// shadcn's DialogContent but apply the dark observatory palette and disable the
// open/close animation under `prefers-reduced-motion`.
// ---------------------------------------------------------------------------

const contentBaseClassName = cn(
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'motion-reduce:animate-none motion-reduce:transition-none',
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]',
  'max-h-[calc(100dvh-4rem)] translate-x-[-50%] translate-y-[-50%] gap-4',
  'overflow-y-auto rounded-xl border p-6 shadow-lg duration-200 sm:max-w-md',
)

/**
 * Styled dialog content shared by every settings modal. Wires the stellar accent
 * to the `--stellar` CSS var so buttons/toggles can pick it up via Tailwind, and
 * renders the close button. Pass `aria-describedby={undefined}` for modals
 * without a subtitle to keep Radix from warning about a missing description.
 */
export function SettingsDialogContent({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const { stellarColor } = useSettingsModals()
  return (
    <DialogPortal>
      <DialogOverlay className="motion-reduce:animate-none" />
      <DialogPrimitive.Content
        data-slot="settings-dialog-content"
        className={cn(contentBaseClassName, className)}
        style={
          {
            background: '#0E0E0E',
            borderColor: '#1C1C1C',
            color: '#FFFDFD',
            '--stellar': stellarColor,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="close"
          className="absolute top-4 right-4 rounded-sm text-[#666] opacity-80 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-[var(--stellar)] focus:outline-hidden [&_svg]:size-4"
        >
          <XIcon />
          <span className="sr-only">close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** Title + optional verbatim subtitle for a modal header. */
export function ModalHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col gap-2 pr-6">
      <DialogTitle className="text-base leading-none font-medium lowercase text-[#FFFDFD]">
        {title}
      </DialogTitle>
      {subtitle && (
        <DialogDescription className="text-xs leading-relaxed text-[#666]">
          {subtitle}
        </DialogDescription>
      )}
    </div>
  )
}

/** Outline button in the stellar accent — the default modal action. */
export function GhostButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg border border-[var(--stellar)] px-6 py-2.5 text-xs text-[var(--stellar)] transition-colors hover:bg-[#FFFDFD] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Solid stellar button — the primary call to action (e.g. upgrade). */
export function PrimaryButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg bg-[var(--stellar)] px-6 py-3 text-xs text-[#0A0A0A] transition-colors hover:bg-[#FFFDFD] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Danger-styled button for destructive actions. */
export function DangerButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg border border-[#3a1010] px-5 py-2.5 text-xs text-[#6a2020] transition-colors hover:bg-[#3a1010] hover:text-[#FFFDFD] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Wraps a danger trigger with an explicit confirm step (alert-dialog). The
 * passed child is the trigger; confirming runs `onConfirm`. Used for every
 * destructive action (delete constellation, close account).
 */
export function DangerConfirm({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel = 'cancel',
  onConfirm,
}: {
  children: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
}) {
  const { stellarColor } = useSettingsModals()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        className="motion-reduce:animate-none motion-reduce:transition-none"
        style={
          {
            background: '#0E0E0E',
            borderColor: '#3a1010',
            color: '#FFFDFD',
            '--stellar': stellarColor,
          } as React.CSSProperties
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-medium lowercase text-[#FFFDFD]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed text-[#888]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#333] bg-transparent text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-[#FFFDFD]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm()}
            className="border-none bg-[#3a1010] text-xs text-[#FFFDFD] hover:bg-[#511616]"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Inline status line — stellar for success, red for error. */
export function StatusLine({
  message,
  tone = 'success',
}: {
  message: string
  tone?: 'success' | 'error'
}) {
  if (!message) return null
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-xs"
      style={{ color: tone === 'error' ? '#c97a6a' : 'var(--stellar)' }}
    >
      {message}
    </p>
  )
}

/** Inline modal error — prototype `modalErr`. Never `alert`. */
export function ModalErr({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-[11.5px] leading-normal text-[#c97a6a]">
      {message}
    </p>
  )
}

const fieldInputClassName =
  'w-full border-0 border-b border-[#1a1a1a] bg-transparent px-0 py-2 text-base text-[#FFFDFD] outline-none placeholder:text-[14px] placeholder:font-light placeholder:text-[#FFFDFD]/50 focus:border-[var(--stellar)]'

/** Label + input matching the v67 modal field. */
export function ModalField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  spellCheck,
}: {
  label: React.ReactNode
  type: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  spellCheck?: boolean
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11.5px] font-medium tracking-[0.1em] text-[#FFFDFD]/50 uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        className={fieldInputClassName}
      />
    </label>
  )
}
