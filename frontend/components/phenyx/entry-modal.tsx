"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSessionColor } from "@/contexts/session-color-context";
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
  const { sessionColor } = useSessionColor();

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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Overlay — clicking it closes the modal. */}
      <div className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-sm" />

      {/* Card — stop propagation so inner clicks don't bubble to the overlay. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        className="relative p-8 md:p-12 max-w-md w-full"
        style={{
          backgroundColor: "#0A0A0A",
          border: "1px solid rgba(255,253,253,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close (×) */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: "rgba(255,253,253,0.5)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFDFD")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,253,253,0.5)")}
          aria-label={entryModalCopy.closeLabel}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Title + sub */}
        <h2
          id="entry-modal-title"
          className="lowercase"
          style={{
            fontSize: "22px",
            fontWeight: 500,
            color: "#FFFDFD",
            marginBottom: "8px",
          }}
        >
          {entryModalCopy.title}
        </h2>
        <p
          className="lowercase"
          style={{
            fontSize: "14px",
            fontWeight: 300,
            color: "rgba(255,253,253,0.6)",
            marginBottom: "32px",
          }}
        >
          {entryModalCopy.subtitle}
        </p>

        {/* Choice buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigateTo(entryModalCopy.returning.href)}
            className="w-full text-left rounded-xl transition-all"
            style={{
              padding: "16px 20px",
              border: `1px solid ${sessionColor}66`,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = sessionColor;
              e.currentTarget.style.backgroundColor = `${sessionColor}14`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${sessionColor}66`;
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span
              className="block lowercase"
              style={{ fontSize: "15px", fontWeight: 400, color: "#FFFDFD" }}
            >
              {entryModalCopy.returning.primary}
            </span>
            <span
              className="block lowercase"
              style={{ fontSize: "12px", color: "rgba(255,253,253,0.5)", marginTop: "4px" }}
            >
              {entryModalCopy.returning.secondary}
            </span>
          </button>

          <button
            onClick={() => navigateTo(entryModalCopy.newcomer.href)}
            className="w-full text-left rounded-xl transition-all"
            style={{
              padding: "16px 20px",
              border: "1px solid rgba(255,253,253,0.12)",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.3)";
              e.currentTarget.style.backgroundColor = "rgba(255,253,253,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.12)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span
              className="block lowercase"
              style={{ fontSize: "15px", fontWeight: 400, color: "#FFFDFD" }}
            >
              {entryModalCopy.newcomer.primary}
            </span>
            <span
              className="block lowercase"
              style={{ fontSize: "12px", color: "rgba(255,253,253,0.5)", marginTop: "4px" }}
            >
              {entryModalCopy.newcomer.secondary}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
