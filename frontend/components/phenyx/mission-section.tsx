import { Constellation } from "./constellation";
import { constellationCopy, polarisCopy, SECTION_IDS } from "@/lib/landing-copy";

export function MissionSection() {
  return (
    <>
      <section id={SECTION_IDS.mission} className="s0-section">
        <div className="s0-inner">
          <p className="s0-eyebrow">{constellationCopy.eyebrow}</p>
          <h2 className="s0-how-headline">{constellationCopy.headline}</h2>
          <div className="s0-identity-grid">
            <div className="s0-identity-copy">
              {constellationCopy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className="s0-thesis"><strong>{constellationCopy.thesis}</strong></p>
            </div>
            <div className="s0-constellation" aria-hidden="true">
              <Constellation />
            </div>
          </div>

          <div className="s0-constellation-example">
            <p className="s0-example-eyebrow">{constellationCopy.exampleEyebrow}</p>
            <div className="s0-seven-points">
              {constellationCopy.sevenPoints.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
            <p className="s0-example-note">{constellationCopy.exampleNote}</p>
          </div>
        </div>
      </section>

      <section id={SECTION_IDS.polaris} className="s0-section">
        <div className="s0-inner">
          <p className="s0-eyebrow">{polarisCopy.eyebrow}</p>
          <h2 className="s0-how-headline">{polarisCopy.headline}</h2>
          <div className="s0-polaris-content">
            {polarisCopy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="s0-thesis"><strong>{polarisCopy.thesis}</strong></p>
          </div>

          <div className="s0-polaris-card">
            <div className="s0-polaris-card__header">
              <span className="s0-polaris-pillar">{polarisCopy.defaultExample.pillar}</span>
            </div>
            <p className="s0-polaris-question">{polarisCopy.defaultExample.question}</p>
            <p className="s0-polaris-answer">{polarisCopy.defaultExample.answer}</p>
            <div className="s0-polaris-meta">
              <span className="s0-polaris-sources">
                {polarisCopy.defaultExample.sources.join(", ")}
              </span>
              <span className="s0-polaris-span">{polarisCopy.defaultExample.span}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
