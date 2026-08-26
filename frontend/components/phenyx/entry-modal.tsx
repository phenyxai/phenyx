"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { entryModalCopy } from "@/lib/landing-copy";

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// EntryModal (PHE-8) — the single decision point that routes a visitor into
// auth. Triggered by every `enter` affordance on the landing page; asks whether
// the person is returning or new and sends them to /signin or /join. It mirrors
// the overlay/dialog structure, session-color usage, and overlay/Escape-close
// patterns of waitlist-modal.tsx for visual consistency.
//
// Exactly one instance is rendered by the landing page; every `enter` source
// just flips the shared `isOpen` state — duplicates are never mounted.
// ============================================================================
export function EntryModal({ isOpen, onClose }: EntryModalProps) {
  const router = useRouter();

  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Element that had focus when the modal opened, so we can restore it on close.
  const triggerElementRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the focus effect (onClose is a
  // fresh closure each parent render, and re-running would recapture focus).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape-key close + focus management. We remember the triggering element on
  // open, move focus into the modal, and return focus to the trigger on close.
  // Depends only on `isOpen` so focus is captured/restored exactly once per open.
  useEffect(() => {
    if (!isOpen) return;

    triggerElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      // Trap focus within the card while the modal is open.
      if (event.key === "Tab" && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Move focus into the modal once it is rendered.
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Return focus to the element that opened the modal.
      triggerElementRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="landing-entry"
      onClick={onClose}
    >
      {/* Overlay — clicking it closes the modal. */}
      <div className="landing-entry__overlay" />

      {/* Card — stop propagation so inner clicks don't bubble to the overlay. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        className="landing-entry__card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close (×) */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="landing-entry__close"
          aria-label={entryModalCopy.closeLabel}
        >
          ×
        </button>

        {/* Title + sub */}
        <h2
          id="entry-modal-title"
          className="landing-entry__title"
        >
          {entryModalCopy.title}
        </h2>
        <p className="landing-entry__subtitle">
          {entryModalCopy.subtitle}
        </p>

        {/* Choice buttons */}
        <div>
          <button
            type="button"
            onClick={() => navigateTo(entryModalCopy.returning.href)}
            className="landing-entry__choice"
          >
            <span>
              {entryModalCopy.returning.primary}
            </span>
            <span className="landing-entry__choice-subtitle">
              {entryModalCopy.returning.secondary}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo(entryModalCopy.newcomer.href)}
            className="landing-entry__choice"
          >
            <span>
              {entryModalCopy.newcomer.primary}
            </span>
            <span className="landing-entry__choice-subtitle">
              {entryModalCopy.newcomer.secondary}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
