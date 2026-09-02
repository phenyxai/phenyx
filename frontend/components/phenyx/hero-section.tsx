"use client";

import { useEffect, useState } from "react";
import { heroCopy, SECTION_IDS } from "@/lib/landing-copy";
import { IdentityParticles } from "./identity-particles";

export function HeroSection({ onEnterClick }: { onEnterClick: () => void }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <header id={SECTION_IDS.top} className="landing-vnext__hero">
      <IdentityParticles prefersReducedMotion={reducedMotion} />
      <div className="landing-vnext__hero-content">
        <h1>{heroCopy.brand}</h1>
        <p className="landing-vnext__hero-tagline">{heroCopy.tagline}</p>
        <p className="landing-vnext__hero-description">{heroCopy.description}</p>
        <EnterButton onClick={onEnterClick} label={heroCopy.enter} />
      </div>
      <div className="landing-vnext__scroll-cue" aria-hidden="true"><span />{heroCopy.scroll}</div>
    </header>
  );
}

export function EnterButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="landing-vnext__enter-button" onClick={onClick}>{label}</button>;
}
