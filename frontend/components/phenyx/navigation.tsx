"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { navCopy, SECTION_IDS } from "@/lib/landing-copy";

interface NavigationProps {
  onEnterClick: () => void;
}

export function Navigation({ onEnterClick }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
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

  useEffect(() => {
    const sections = navCopy.links
      .map((link) => document.getElementById(link.targetId))
      .filter((section): section is HTMLElement => Boolean(section));
    const hero = document.getElementById(SECTION_IDS.top);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -45%", threshold: [0, 0.15, 0.4] },
    );
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActiveId(null);
      },
      { rootMargin: "-20% 0px -60%" },
    );
    sections.forEach((section) => observer.observe(section));
    if (hero) heroObserver.observe(hero);
    return () => {
      observer.disconnect();
      heroObserver.disconnect();
    };
  }, []);

  const enter = () => {
    setIsOpen(false);
    onEnterClick();
  };

  return (
    <nav ref={navRef} className="landing-v66__nav" aria-label="Primary navigation">
      <a className="landing-v66__nav-logo" href={`#${SECTION_IDS.top}`}>
        <Image src="/phenyx-logo.png" alt={navCopy.logoAlt} width={18} height={18} priority />
        <span>{navCopy.brand}</span>
      </a>

      <div className="landing-v66__nav-links">
        {navCopy.links.map((link) => (
          <a
            key={link.targetId}
            href={`#${link.targetId}`}
            className={activeId === link.targetId ? "is-active" : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>

      <button type="button" className="landing-v66__nav-enter" onClick={enter}>
        {navCopy.enter}
      </button>

      <button
        type="button"
        className="landing-v66__menu-button"
        data-open={isOpen}
        aria-label={navCopy.menuLabel}
        aria-expanded={isOpen}
        aria-controls="landing-nav-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>

      <div id="landing-nav-menu" className="landing-v66__nav-dropdown" data-open={isOpen}>
        {navCopy.links.map((link) => (
          <a key={link.targetId} href={`#${link.targetId}`} onClick={() => setIsOpen(false)}>
            {link.label}
          </a>
        ))}
        <button type="button" onClick={enter}>{navCopy.enter}</button>
      </div>
    </nav>
  );
}
