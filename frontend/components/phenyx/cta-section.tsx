"use client";

import { useRef } from "react";
import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";
import { EnterButton } from "./hero-section";
import { EntranceWords, useEntrance } from "./use-entrance";

export function CtaSection({ onEnterClick }: { onEnterClick: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEntrance(ref);
  return (
    <section ref={ref} id={SECTION_IDS.cta} className="landing-vnext__cta">
      <h2 data-entrance="headline"><EntranceWords text={ctaCopy.headline} /></h2>
      <EnterButton onClick={onEnterClick} label={ctaCopy.enter} entrance />
    </section>
  );
}
