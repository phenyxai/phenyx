import { Constellation } from "./constellation";
import { AskPolarisWidget } from "./ask-polaris-widget";
import { constellationCopy, SECTION_IDS } from "@/lib/landing-copy";

export function MissionSection() {
  return (
    <section id={SECTION_IDS.mission} className="landing-v66__identity-section">
      <div className="landing-v66__inner">
        <p className="landing-v66__eyebrow">{constellationCopy.eyebrow}</p>
        <h2 className="landing-v66__section-headline">{constellationCopy.headline}</h2>
        <div className="landing-v66__identity-grid">
          <div className="landing-v66__identity-copy">
            {constellationCopy.lines.map((line, index) => (
              <p key={line}>{index === constellationCopy.lines.length - 1 ? <strong>{line}</strong> : line}</p>
            ))}
          </div>
          <div className="landing-v66__constellation" aria-hidden="true">
            <Constellation />
          </div>
        </div>

        <h3 id={SECTION_IDS.polaris} className="landing-v66__polaris-heading">{constellationCopy.polarisHeading}</h3>
        <p className="landing-v66__polaris-lead">{constellationCopy.polarisLead}</p>
        <AskPolarisWidget />
      </div>
    </section>
  );
}
