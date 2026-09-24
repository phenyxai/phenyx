"use client";

import { useEffect, useRef, useState } from "react";
import { navCopy, SECTION_IDS, SECTION_ORDER } from "@/lib/landing-copy";

interface NavigationProps { onEnterClick: () => void }

export function Navigation({ onEnterClick }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    const closeOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  // Scroll-spy. An IntersectionObserver only reports the entries that changed,
  // so picking a winner out of that batch skips the section that merely stayed
  // put and switches the underline a section early. Measuring the viewport
  // midline directly asks the question the design asks (which section owns the
  // middle of the screen) and gives the same answer on every frame, including
  // during a smooth-scroll jump. The order is the order of the page; the hero
  // and the closing call to action are read but own no link, so above the first
  // section and below the last nothing is current, which is also information.
  useEffect(() => {
    const owned = new Set<string>(navCopy.links.map((link) => link.targetId));
    const sections = SECTION_ORDER
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;

    let current: string | null | undefined;
    const pick = () => {
      const mid = window.innerHeight / 2;
      let owner: string | null = null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= mid && rect.bottom > mid) {
          owner = section.id;
          break;
        }
      }
      if (!owner) {
        // between sections, or shorter than the gap: the last one already passed
        for (let i = sections.length - 1; i >= 0; i -= 1) {
          if (sections[i].getBoundingClientRect().top <= mid) {
            owner = sections[i].id;
            break;
          }
        }
      }
      const next = owner && owned.has(owner) ? owner : null;
      if (next === current) return;
      current = next;
      setActiveId(next);
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        pick();
      });
    };
    // The landing may scroll inside its own container rather than the window
    // (the fixed-screen layout), so the nearest scrollable ancestor of the
    // sections is listened to as well as the window.
    let scroller: HTMLElement | null = sections[0].parentElement;
    while (scroller && scroller !== document.body) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (scroller === document.body) scroller = null;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("load", pick);
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    pick();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", pick);
      scroller?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const enter = () => { setIsOpen(false); onEnterClick(); };

  return (
    <nav ref={navRef} className="landing-vnext__nav" aria-label="Primary navigation">
      <a className="landing-vnext__nav-logo" href={`#${SECTION_IDS.top}`}>
        <span className="landing-vnext__brand-dot" aria-hidden="true" /><span>{navCopy.brand}</span>
      </a>
      <div className="landing-vnext__nav-links">
        {navCopy.links.map((link) => (
          <a
            key={link.targetId}
            href={`#${link.targetId}`}
            data-active={activeId === link.targetId}
            aria-current={activeId === link.targetId ? "true" : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>
      <button type="button" className="landing-vnext__nav-enter" onClick={enter}>{navCopy.enter}</button>
      <button
        type="button"
        className="landing-vnext__menu-button"
        data-open={isOpen}
        aria-label={navCopy.menuLabel}
        aria-expanded={isOpen}
        aria-controls="landing-nav-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>
      <div id="landing-nav-menu" className="landing-vnext__nav-dropdown" data-open={isOpen}>
        {navCopy.links.map((link) => (
          <a
            key={link.targetId}
            href={`#${link.targetId}`}
            data-active={activeId === link.targetId}
            aria-current={activeId === link.targetId ? "true" : undefined}
            onClick={() => setIsOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <button type="button" onClick={enter}>{navCopy.enter}</button>
      </div>
    </nav>
  );
}
