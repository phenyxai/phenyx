"use client";

import { useEffect, useRef, useState } from "react";
import { navCopy, SECTION_IDS } from "@/lib/landing-copy";
import { watchLandingScroll } from "./landing-dom";

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

  // Scroll-spy, as the export does it: a reading line sits just under the nav
  // (the nav's height plus 18% of the screen, held between 72px and 150px), and
  // the current chapter is the last one whose top has crossed it. Above the
  // first chapter and once the closing call to action reaches the line,
  // nothing is current.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const chapters = navCopy.links
      .map((link) => document.getElementById(link.targetId))
      .filter((chapter): chapter is HTMLElement => Boolean(chapter));
    const cta = document.getElementById(SECTION_IDS.cta);
    if (!chapters.length) return;
    return watchLandingScroll(nav, (scroller) => {
      const readingY =
        scroller.getBoundingClientRect().top +
        nav.getBoundingClientRect().height +
        Math.min(150, Math.max(72, scroller.clientHeight * 0.18));
      let current: string | null = null;
      if (chapters[0].getBoundingClientRect().top <= readingY && !(cta && cta.getBoundingClientRect().top <= readingY)) {
        for (const chapter of chapters) if (chapter.getBoundingClientRect().top <= readingY) current = chapter.id;
      }
      setActiveId(current);
    });
  }, []);

  const enter = () => { setIsOpen(false); onEnterClick(); };

  return (
    <nav ref={navRef} className="landing-vnext__nav" aria-label="Primary navigation">
      <a className="landing-vnext__nav-logo" href={`#${SECTION_IDS.top}`}>
        <span className="landing-vnext__brand-dot" aria-hidden="true" /><span className="landing-vnext__nav-word">{navCopy.brand}</span>
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
