"use client";

import { useEffect, useState } from "react";
import { IdentityParticles } from "./identity-particles";
import { heroCopy, SECTION_IDS } from "@/lib/landing-copy";

interface HeroSectionProps { onEnterClick: () => void }

export function HeroSection({ onEnterClick }: HeroSectionProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <header id={SECTION_IDS.top} className="landing-v66__hero">
      <IdentityParticles prefersReducedMotion={reducedMotion} />
      <div className="landing-v66__hero-content">
        <p className="landing-v66__hero-preline">{heroCopy.preHeadline}</p>
        <h1>{heroCopy.brand}</h1>
        <p className="landing-v66__hero-tagline">{heroCopy.tagline}</p>
        <EnterButton onClick={onEnterClick} label={heroCopy.enter} />
      </div>
      <div className="landing-v66__scroll-cue" aria-hidden="true">
        <span />
        {heroCopy.scroll}
      </div>
    </header>
  );
}

export function EnterButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="landing-v66__enter-button" onClick={onClick}>
      <span>{label}</span>
      <svg aria-hidden="true" width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M.5 5H15M15 5 10.5.5M15 5l-4.5 4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
