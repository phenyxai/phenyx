'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useSessionColor } from '@/contexts/session-color-context'
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
import { SubscriptionModal } from './subscription'

// ---------------------------------------------------------------------------
// Settings & Account modal host (PHE-32; chrome restyled for v244 in PHE-95).
//
// A single Dialog portal opens any one of the settings modals by id.
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
  | 'subscription'

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
  const { sessionColor: stellarColor } = useSessionColor()

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
        {openId === 'subscription' && <SubscriptionModal />}
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
// shadcn's DialogContent but apply the PHENYX chrome (flat black, accent edge;
// PHE-98 replaced the v244 blue-black gradient) and disable the open/close animation
// under `prefers-reduced-motion`. The overlay scrim itself is the default in
// `components/ui/dialog.tsx` (and alert-dialog), so every dialog shares it.
// ---------------------------------------------------------------------------

const contentBaseClassName = cn(
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'motion-reduce:animate-none motion-reduce:transition-none',
  'fixed top-[50%] left-[50%] z-50 grid w-[min(440px,calc(100vw-40px))] max-w-none',
  'max-h-[calc(100dvh-4rem)] translate-x-[-50%] translate-y-[-50%] gap-4',
  'overflow-y-auto rounded-2xl border p-6 duration-200',
)

/** The modal surface: flat black with an accent edge (PHE-98: no gradients). */
const modalSurfaceStyle: React.CSSProperties = {
  background: 'var(--black)',
  borderColor: 'rgba(var(--s-rgb), 0.2)',
  boxShadow:
    '0 0 0 1px rgba(var(--white-rgb), 0.03), 0 30px 80px -20px rgba(var(--black-rgb), 0.75)',
  color: 'var(--white)',
}

/**
 * Styled dialog content shared by every settings modal: the flat surface above
 * plus the close button. Buttons and toggles read the accent from `--s`. Pass `aria-describedby={undefined}`
 * for modals without a subtitle to keep Radix from warning about a missing
 * description.
 */
export function SettingsDialogContent({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay className="motion-reduce:animate-none" />
      <DialogPrimitive.Content
        data-slot="settings-dialog-content"
        className={cn(contentBaseClassName, className)}
        style={{ ...modalSurfaceStyle, ...style }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="close"
          className="absolute top-4 right-4 rounded-sm text-white/55 opacity-80 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-[var(--s)] focus:outline-hidden [&_svg]:size-4"
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
      <DialogTitle className="text-base leading-none font-medium lowercase text-white">
        {title}
      </DialogTitle>
      {subtitle && (
        <DialogDescription className="text-xs leading-relaxed text-white/70">
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
        'rounded-lg border border-[var(--s)] px-6 py-2.5 text-xs text-[var(--s)] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Accent-tinted button — the primary call to action (e.g. upgrade). v244
 * (`.modal-btn-main`): a 10% stellar fill inside a 38% stellar border, white
 * text, medium weight.
 */
export function PrimaryButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-[10px] border border-[rgba(var(--s-rgb),0.38)] bg-[rgba(var(--s-rgb),0.10)] px-6 py-3 text-xs font-medium text-white transition-colors hover:bg-[rgba(var(--s-rgb),0.18)] disabled:cursor-not-allowed disabled:opacity-50',
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
        'btn-danger rounded-lg border border-red/25 px-5 py-2.5 text-xs text-red/70 transition-colors hover:bg-red/15 disabled:cursor-not-allowed disabled:opacity-50',
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
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        className="rounded-2xl motion-reduce:animate-none motion-reduce:transition-none"
        style={{
          ...modalSurfaceStyle,
          borderColor: 'rgba(var(--red-rgb), 0.25)',
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-medium lowercase text-white">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed text-white/50">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/18 bg-transparent text-xs text-white/50 hover:bg-white/[0.065]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm()}
            className="btn-danger border-none bg-red/25 text-xs text-white hover:bg-red/35"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Inline status line: green for success, red for error. */
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
      style={{ color: tone === 'error' ? 'var(--red)' : 'var(--green)' }}
    >
      {message}
    </p>
  )
}

/** Inline modal error — prototype `modalErr`. Never `alert`. */
export function ModalErr({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-[11.5px] leading-normal text-red">
      {message}
    </p>
  )
}

const fieldInputClassName =
  'w-full border-0 border-b border-white/[0.065] bg-transparent px-0 py-2 text-base text-white outline-none placeholder:text-[14px] placeholder:font-light placeholder:text-white/50 focus:border-[var(--s)]'

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
      <span className="text-[11.5px] font-medium tracking-[0.1em] text-white/50 uppercase">
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
