import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";
import { EnterButton } from "./hero-section";

export function CtaSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <section id={SECTION_IDS.cta} className="s0-cta">
      <h2 className="s0-cta__headline">{ctaCopy.headline}</h2>
      <p className="s0-cta__subline">{ctaCopy.subline}</p>
      <EnterButton onClick={onEnterClick} label={ctaCopy.enter} />
    </section>
  );
}
