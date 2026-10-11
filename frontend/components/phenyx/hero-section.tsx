"use client";

import { heroCopy, SECTION_IDS } from "@/lib/landing-copy";
import { IdentityParticles } from "./identity-particles";

export function HeroSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <header id={SECTION_IDS.top} className="landing-vnext__hero">
      <IdentityParticles />
      <div className="landing-vnext__hero-content">
        <h1>{heroCopy.brand}</h1>
        <p className="landing-vnext__hero-tagline">{heroCopy.tagline}</p>
        <p className="landing-vnext__hero-description">
          {heroCopy.descriptionLines.map((line) => <span key={line}>{line}</span>)}
        </p>
        <EnterButton onClick={onEnterClick} label={heroCopy.enter} />
      </div>
    </header>
  );
}

/** `entrance`: float in as a block of the section around it (see use-entrance). */
export function EnterButton({ onClick, label, entrance }: { onClick: () => void; label: string; entrance?: boolean }) {
  return (
    <button type="button" className="landing-vnext__enter-button" onClick={onClick} data-entrance={entrance ? "block" : undefined}>
      <span>{label}</span>
    </button>
  );
}
