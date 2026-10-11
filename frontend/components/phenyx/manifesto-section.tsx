"use client";

import { useEffect, useRef, useState } from "react";
import { manifestoCopy, SECTION_IDS } from "@/lib/landing-copy";
import { PlatformField } from "./platform-field";
import { EntranceWords, useEntrance } from "./use-entrance";

export function ManifestoSection() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEntrance(ref);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <section ref={ref} id={SECTION_IDS.about} className="landing-vnext__section landing-vnext__about">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-entrance="eyebrow">{manifestoCopy.eyebrow}</p>
        <h2 data-entrance="headline"><EntranceWords text={manifestoCopy.headline} /></h2>
        <div className="landing-vnext__about-grid">
          <div className="landing-vnext__about-copy">
            {manifestoCopy.paragraphs.map((paragraph) => <p key={paragraph} data-entrance="lede">{paragraph}</p>)}
            <p className="landing-vnext__thesis" data-entrance="lede">{manifestoCopy.emphasis}</p>
          </div>
          <div className="landing-vnext__platform-field" data-entrance="block">
            <PlatformField prefersReducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}
