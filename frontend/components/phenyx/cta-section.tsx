import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";
import { EnterButton } from "./hero-section";

export function CtaSection({ onEnterClick }: { onEnterClick: () => void }) {
  return (
    <section id={SECTION_IDS.cta} className="landing-v66__cta">
      <h2>{ctaCopy.headline}</h2>
      <p>{ctaCopy.subline}</p>
      <EnterButton onClick={onEnterClick} label={ctaCopy.enter} />
    </section>
  );
}
