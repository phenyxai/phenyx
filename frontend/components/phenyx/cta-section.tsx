import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";
import { EnterButton } from "./hero-section";

export function CtaSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <section id={SECTION_IDS.cta} className="landing-vnext__cta">
      <h2 data-reveal>{ctaCopy.headline}</h2>
      <p data-reveal>{ctaCopy.subline}</p>
      <EnterButton onClick={onEnterClick} label={ctaCopy.enter} />
    </section>
  );
}
