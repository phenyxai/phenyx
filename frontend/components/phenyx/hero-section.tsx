"use client";

import { heroCopy, SECTION_IDS } from "@/lib/landing-copy";
import { HeroStarfield } from "./hero-starfield";
import { IdentityParticles } from "./identity-particles";

export function HeroSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <header id={SECTION_IDS.top} className="landing-vnext__hero">
      <div className="landing-vnext__hero-particles" aria-hidden="true">
        <HeroStarfield />
        <IdentityParticles />
      </div>
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
