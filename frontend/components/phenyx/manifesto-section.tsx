"use client";

import { useEffect, useState } from "react";
import { manifestoCopy, SECTION_IDS } from "@/lib/landing-copy";
import { PlatformField } from "./platform-field";

export function ManifestoSection() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section id={SECTION_IDS.about} className="landing-vnext__section landing-vnext__about">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{manifestoCopy.eyebrow}</p>
        <h2 data-reveal>{manifestoCopy.headline}</h2>
        <div className="landing-vnext__about-grid" data-reveal>
          <div className="landing-vnext__about-copy">
            {manifestoCopy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className="landing-vnext__thesis">{manifestoCopy.emphasis}</p>
          </div>
          <div className="landing-vnext__platform-field" aria-hidden="true">
            <PlatformField prefersReducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}
