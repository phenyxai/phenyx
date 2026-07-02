import { Constellation } from "./constellation";
import { AskPolarisWidget } from "./ask-polaris-widget";
import { constellationCopy, BRAND, SECTION_IDS } from "@/lib/landing-copy";

export function MissionSection() {
  return (
    <section id={SECTION_IDS.mission} className="px-6 md:px-20" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
      <div className="mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-start" style={{ maxWidth: "1100px" }}>
        {/* Left column - Text */}
        <div className="space-y-8">
          {/* Eyebrow */}
          <p
            className="uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "rgba(255,253,253,0.6)",
            }}
          >
            {constellationCopy.eyebrow}
          </p>

          <div className="lowercase space-y-6">
            {/* Body text - 20px, weight 300, line height 1.7 */}
            {constellationCopy.missionParagraphs.map((paragraph, index) => (
              <p
                key={index}
                style={{
                  fontSize: "20px",
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: "rgba(255,253,253,0.9)",
                }}
              >
                {paragraph}
              </p>
            ))}
            <p
              style={{
                fontSize: "20px",
                fontWeight: 400,
                lineHeight: 1.7,
                color: "#FFFDFD",
              }}
            >
              <span className="uppercase">{BRAND}</span> {constellationCopy.missionEmphasisSuffix}
            </p>
          </div>

          {/*
            Ask-Polaris Q&A widget mount point (PHE-25). This section owns the
            placement/layout only; the rotating-question behavior + curated
            content live in AskPolarisWidget. The widget renders the seeded lead
            copy (`constellationCopy.polarisLead`) as its own heading.
          */}
          <div
            id="ask-polaris-mount"
            className="pt-4"
            style={{ borderTop: "1px solid rgba(255,253,253,0.06)" }}
          >
            <AskPolarisWidget />
          </div>
        </div>

        {/* Right column - Constellation */}
        <div>
          <Constellation />
        </div>
      </div>
    </section>
  );
}
