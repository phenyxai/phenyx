import { constellationCopy, SECTION_IDS } from "@/lib/landing-copy";
import { LandingConstellation } from "./landing-constellation";
import { ConstellationExample } from "./constellation-example";

export function MissionSection() {
  return (
    <section id={SECTION_IDS.mission} className="landing-vnext__section landing-vnext__mission">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{constellationCopy.eyebrow}</p>
        <h2 data-reveal>{constellationCopy.headline}</h2>
        <div className="landing-vnext__mission-grid" data-reveal>
          <div className="landing-vnext__mission-copy">
            {constellationCopy.lines.map((line) => <p key={line}>{line}</p>)}
            <p className="landing-vnext__thesis">{constellationCopy.emphasis}</p>
          </div>
          <LandingConstellation />
        </div>
        <ConstellationExample />
      </div>
    </section>
  );
}
