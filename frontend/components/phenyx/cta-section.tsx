import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";
import { EnterButton } from "./hero-section";

export function CtaSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <section id={SECTION_IDS.cta} className="landing-vnext__cta">
      <h2 data-reveal="1">{ctaCopy.headline}</h2>
      <p data-reveal="2">{ctaCopy.subline}</p>
      <EnterButton onClick={onEnterClick} label={ctaCopy.enter} />
    </section>
  );
}
