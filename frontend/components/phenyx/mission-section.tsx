import { Constellation } from "./constellation";
import { constellationCopy, polarisCopy, SECTION_IDS } from "@/lib/landing-copy";

export function MissionSection() {
  return (
    <>
      <section id={SECTION_IDS.mission} className="landing-v66__identity-section">
        <div className="landing-v66__inner">
          <p className="landing-v66__eyebrow">{constellationCopy.eyebrow}</p>
          <h2 className="landing-v66__section-headline">{constellationCopy.headline}</h2>
          <div className="landing-v66__identity-grid">
            <div className="landing-v66__identity-copy">
              {constellationCopy.paragraphs.map((paragraph, index) => (
                <p key={paragraph}>
                  {index === constellationCopy.paragraphs.length - 1 ? paragraph : paragraph}
                </p>
              ))}
              <p className="landing-v66__thesis"><strong>{constellationCopy.thesis}</strong></p>
            </div>
            <div className="landing-v66__constellation" aria-hidden="true">
              <Constellation />
            </div>
          </div>

          <div className="landing-v66__constellation-example">
            <p className="landing-v66__example-eyebrow">{constellationCopy.exampleEyebrow}</p>
            <div className="landing-v66__seven-points">
              {constellationCopy.sevenPoints.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
            <p className="landing-v66__example-note">{constellationCopy.exampleNote}</p>
          </div>
        </div>
      </section>

      <section id={SECTION_IDS.polaris} className="landing-v66__polaris-section">
        <div className="landing-v66__inner">
          <p className="landing-v66__eyebrow">{polarisCopy.eyebrow}</p>
          <h2 className="landing-v66__section-headline">{polarisCopy.headline}</h2>
          <div className="landing-v66__polaris-content">
            {polarisCopy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="landing-v66__thesis"><strong>{polarisCopy.thesis}</strong></p>
          </div>

          <div className="landing-v66__polaris-preview">
            <div className="landing-v66__polaris-card">
              <div className="landing-v66__polaris-card-header">
                <span className="landing-v66__polaris-pillar">{polarisCopy.defaultExample.pillar}</span>
              </div>
              <p className="landing-v66__polaris-question">{polarisCopy.defaultExample.question}</p>
              <p className="landing-v66__polaris-answer">{polarisCopy.defaultExample.answer}</p>
              <div className="landing-v66__polaris-meta">
                <span className="landing-v66__polaris-sources">
                  {polarisCopy.defaultExample.sources.join(", ")}
                </span>
                <span className="landing-v66__polaris-span">{polarisCopy.defaultExample.span}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
