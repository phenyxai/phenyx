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

import { NotificationsModal } from './notifications'
import { ConnectionsModal } from './connections'
import { DataManagementModal } from './data-management'
import { CloseAccountModal } from './close-account'
import { EditProfileModal } from './edit-profile'
import { FeedbackModal } from './feedback'

// ---------------------------------------------------------------------------
// Settings & Account modal host (PHE-32; chrome restyled for v244 in PHE-95).
//
// A single Dialog portal opens any one of the settings modals by id.
// Radix Dialog gives us the focus trap, `esc` / overlay-click close, and focus
// return to the trigger for free. Consumers wrap their tree in
// `SettingsModalsProvider` and call `useSettingsModals().openModal(id)` from any
// settings row or GET IN TOUCH action.
// ---------------------------------------------------------------------------

export type SettingsModalId =
  | 'notifications'
  | 'my-connections'
  | 'data-management'
  | 'close-account'
  | 'edit-profile'
  | 'feedback'

interface SettingsModalsContextValue {
  /** The currently open modal id, or null when nothing is open. */
  openId: SettingsModalId | null
  /** Open a modal by id. The triggering element regains focus on close. */
  openModal: (id: SettingsModalId) => void
  /** Close whatever modal is open. */
  closeModal: () => void
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
  const openModal = React.useCallback((id: SettingsModalId) => setOpenId(id), [])
  const closeModal = React.useCallback(() => setOpenId(null), [])

  const value = React.useMemo<SettingsModalsContextValue>(
    () => ({ openId, openModal, closeModal }),
    [openId, openModal, closeModal],
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
        {openId === 'notifications' && <NotificationsModal />}
        {openId === 'my-connections' && <ConnectionsModal />}
        {openId === 'data-management' && <DataManagementModal />}
        {openId === 'close-account' && <CloseAccountModal />}
        {openId === 'edit-profile' && <EditProfileModal />}
        {openId === 'feedback' && <FeedbackModal />}
      </Dialog>
    </SettingsModalsContext.Provider>
  )
}

/** Access the modal opener/closer from any descendant. */
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
// shadcn's DialogContent but apply the v244 blue-black chrome (prototype style
// id `v240-modal-coverage-and-colour`) and disable the open/close animation
// under `prefers-reduced-motion`. The overlay scrim itself is the default in
// `components/ui/dialog.tsx` (and alert-dialog), so every dialog shares it.
// ---------------------------------------------------------------------------

const contentBaseClassName = cn(
  'data-[state=open]:animate-in data-[state=closed]:animate-out',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'motion-reduce:animate-none motion-reduce:transition-none',
  'fixed top-[50%] left-[50%] z-50 grid grid-cols-[minmax(0,1fr)] w-[min(440px,calc(100vw-40px))] max-w-none',
  'max-h-[calc(100dvh-4rem)] translate-x-[-50%] translate-y-[-50%] gap-4',
  'overflow-y-auto rounded-2xl border p-6 duration-200',
)

/** The modal surface (PHE-98): flat black with a faint accent edge, no gradient. */
const MODAL_SURFACE_STYLE: React.CSSProperties = {
  background: 'var(--ph-black)',
  borderColor: 'rgba(var(--ph-accent-rgb),0.20)',
  boxShadow: '0 0 0 1px rgba(242,242,243,0.03), 0 30px 80px -20px rgba(0,0,0,0.75)',
  color: 'var(--ph-white)',
}

/**
 * Styled dialog content shared by every settings modal. Buttons and toggles
 * read the accent from the `--stellar` / `--stellar-rgb` aliases of
 * `--ph-accent`, and this renders the close button. Pass `aria-describedby={undefined}`
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
        style={{ ...MODAL_SURFACE_STYLE, ...style }}
        {...props}
      >
        {children}
        {/* PHE-147: only the x, never a box. Radix focuses it when a pop-up
            opens, so the old focus ring drew a frame around it on every open;
            keyboard focus now shows as the accent instead. */}
        <DialogPrimitive.Close
          aria-label="close"
          className="absolute top-4 right-4 border-0 bg-transparent p-0 text-ph-secondary opacity-80 shadow-none outline-none hover:opacity-100 focus-visible:text-[var(--ph-accent)] focus-visible:opacity-100 [&_svg]:size-4"
        >
          <XIcon />
          <span className="sr-only">close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/** Title + optional verbatim subtitle for a modal header (PHE-163: no dot beside the title). */
export function ModalHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col gap-2 pr-6">
      <DialogTitle className="text-title lowercase text-ph-white">{title}</DialogTitle>
      {subtitle && (
        <DialogDescription className="text-body text-ph-secondary">
          {subtitle}
        </DialogDescription>
      )}
    </div>
  )
}

/** The small glowing accent dot that marks polaris's thinking states. */
export function AccentDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--ph-accent)] shadow-[0_0_10px_rgba(var(--ph-accent-rgb),0.75)]',
        className,
      )}
    />
  )
}

/**
 * A pop-up outside the settings ids (source trails, saved discoveries, polaris
 * usage and conversations): the same Radix dialog, surface and heading, opened
 * by rendering it and closed through `onClose`. It portals to the body, so a
 * transformed parent never traps it.
 */
export function Popup({
  title,
  onClose,
  className,
  children,
}: {
  title: string
  onClose: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <SettingsDialogContent aria-describedby={undefined} className={className}>
        <ModalHeading title={title} />
        {children}
      </SettingsDialogContent>
    </Dialog>
  )
}

/** A pop-up's quiet alternative, 12px under its main action. */
export function QuietAction({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        '-mt-1 self-center text-body text-ph-secondary transition-colors duration-200 hover:text-[var(--ph-accent)]',
        className,
      )}
      {...props}
    />
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
        'ph-button rounded-lg border border-[var(--stellar)] px-6 text-body font-medium text-[var(--stellar)] hover:bg-[rgba(var(--stellar-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/**
 * The primary call to action. PHE-129: framed, never filled, spanning the
 * content width, in the accent; the hover adds a faint fill.
 */
export function PrimaryButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'ph-button w-full rounded-full border border-[rgba(var(--stellar-rgb),0.5)] bg-transparent px-6 text-body font-medium text-[var(--stellar)] transition-colors duration-200 hover:bg-[rgba(var(--stellar-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Danger-styled button for destructive actions (semantic red, PHE-98). */
export function DangerButton({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'ph-button rounded-lg border border-ph-red/30 px-5 text-body font-medium text-ph-red hover:bg-ph-red/10 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Inline status line — semantic green for success, red for error (PHE-98). */
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
      className="text-body"
      style={{ color: tone === 'error' ? 'var(--ph-red)' : 'var(--ph-green)' }}
    >
      {message}
    </p>
  )
}

/** Inline modal error — prototype `modalErr`. Never `alert`. */
export function ModalErr({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-meta text-ph-red">
      {message}
    </p>
  )
}

const fieldInputClassName =
  'w-full text-reading text-ph-white outline-none placeholder:text-ph-tertiary focus:border-ph-accent'

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
      <span className="text-meta text-ph-secondary">
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
