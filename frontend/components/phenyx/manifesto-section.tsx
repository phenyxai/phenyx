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
    <section id={SECTION_IDS.about} className="landing-v66__section landing-v66__about">
      <div className="landing-v66__inner">
        <p className="landing-v66__eyebrow">{manifestoCopy.eyebrow}</p>
        <h2 className="landing-v66__first-headline">{manifestoCopy.headline}</h2>
        <div className="landing-v66__about-grid">
          <div className="landing-v66__about-copy">
            {manifestoCopy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className="landing-v66__thesis"><strong>{manifestoCopy.thesis}</strong></p>
          </div>
          <div className="landing-v66__platform-field" aria-hidden="true">
            <PlatformField prefersReducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}
