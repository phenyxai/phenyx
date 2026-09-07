'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { hexToRgb } from '@/lib/stellar'
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
    // The shell paints with `--s` / `--s-rgb` (sidebar orb, plan pill, gear).
    // SessionColorProvider in the root layout owns those vars and reconciles
    // them against user_profiles.stellar_color; this only fills them on a fresh
    // load where nothing has set them yet, so the shell never renders colourless.
    const root = document.documentElement
    if (!root.style.getPropertyValue('--s')) {
      const color = stored || STELLAR_DEFAULT
      root.style.setProperty('--s', color)
      root.style.setProperty('--s-rgb', hexToRgb(color))
    }
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
  'fixed top-[50%] left-[50%] z-50 grid w-[min(440px,calc(100vw-40px))] max-w-none',
  'max-h-[calc(100dvh-4rem)] translate-x-[-50%] translate-y-[-50%] gap-4',
  'overflow-y-auto rounded-2xl border p-6 duration-200',
)

/** The modal surface: an accent-tinted light source over a blue-black ground. */
function modalSurfaceStyle(stellarColor: string): React.CSSProperties {
  const rgb = hexToRgb(stellarColor)
  return {
    background: `radial-gradient(120% 88% at 50% -18%, rgba(${rgb},0.10), transparent 66%), linear-gradient(180deg, #0c0f16 0%, #090b10 100%)`,
    borderColor: `rgba(${rgb},0.20)`,
    boxShadow:
      '0 0 0 1px rgba(255,253,253,0.03), 0 30px 80px -20px rgba(0,0,0,0.75)',
    color: '#FFFDFD',
    '--stellar': stellarColor,
    '--stellar-rgb': rgb,
  } as React.CSSProperties
}

/**
 * Styled dialog content shared by every settings modal. Wires the stellar accent
 * to the `--stellar` / `--stellar-rgb` CSS vars so buttons/toggles can pick it
 * up via Tailwind, and renders the close button. Pass `aria-describedby={undefined}`
 * for modals without a subtitle to keep Radix from warning about a missing
 * description.
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
        style={{ ...modalSurfaceStyle(stellarColor), ...style }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="close"
          className="absolute top-4 right-4 rounded-sm text-[#FFFDFD]/55 opacity-80 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-[var(--stellar)] focus:outline-hidden [&_svg]:size-4"
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
        <DialogDescription className="text-xs leading-relaxed text-[rgba(255,253,253,0.70)]">
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
        'w-full rounded-[10px] border border-[rgba(var(--stellar-rgb),0.38)] bg-[rgba(var(--stellar-rgb),0.10)] px-6 py-3 text-xs font-medium text-[#FFFDFD] transition-colors hover:bg-[rgba(var(--stellar-rgb),0.18)] disabled:cursor-not-allowed disabled:opacity-50',
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
        className="rounded-2xl motion-reduce:animate-none motion-reduce:transition-none"
        style={{
          ...modalSurfaceStyle(stellarColor),
          borderColor: '#3a1010',
        }}
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
