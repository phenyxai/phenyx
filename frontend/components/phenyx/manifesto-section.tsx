"use client";

import { useEffect, useState } from "react";
import { manifestoCopy, SECTION_IDS } from "@/lib/landing-copy";
import { PlatformField } from "./platform-field";

export function ManifestoSection() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
  }, []);

  return (
    <section id={SECTION_IDS.about} className="s0-section">
      <div className="s0-inner">
        <p className="s0-eyebrow">{manifestoCopy.eyebrow}</p>
        <h2 className="s0-headline">{manifestoCopy.headline}</h2>
        <div className="s0-about-grid">
          <div className="s0-about-copy">
            {manifestoCopy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className="s0-thesis"><strong>{manifestoCopy.thesis}</strong></p>
          </div>
          <div className="s0-platform-field" aria-hidden="true">
            <PlatformField prefersReducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}
