"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { entryModalCopy } from "@/lib/landing-copy";

interface EntryModalProps { isOpen: boolean; onClose: () => void }

export function EntryModal({ isOpen, onClose }: EntryModalProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const controls = cardRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="landing-vnext__modal-layer" onMouseDown={onClose}>
      <div className="landing-vnext__modal-overlay" />
      <div
        ref={cardRef}
        className="landing-vnext__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="landing-vnext__modal-close" onClick={onClose} aria-label={entryModalCopy.closeLabel}>×</button>
        <h2 id="entry-modal-title">{entryModalCopy.title}</h2>
        <p>{entryModalCopy.subtitle}</p>
        <button type="button" className="landing-vnext__modal-choice" onClick={() => navigateTo(entryModalCopy.returning.href)}>
          <span>{entryModalCopy.returning.primary}</span><small>{entryModalCopy.returning.secondary}</small>
        </button>
        <button type="button" className="landing-vnext__modal-choice" onClick={() => navigateTo(entryModalCopy.newcomer.href)}>
          <span>{entryModalCopy.newcomer.primary}</span><small>{entryModalCopy.newcomer.secondary}</small>
        </button>
      </div>
    </div>
  );
}
