import { polarisCopy, SECTION_IDS } from "@/lib/landing-copy";
import { AskPolarisWidget } from "./ask-polaris-widget";

export function PolarisSection() {
  return (
    <section id={SECTION_IDS.polaris} className="landing-vnext__section landing-vnext__polaris">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{polarisCopy.eyebrow}</p>
        <h2 data-reveal>{polarisCopy.headline}</h2>
        <div className="landing-vnext__polaris-grid" data-reveal>
          <div className="landing-vnext__polaris-copy">
            <p><strong>{polarisCopy.leadStrong}</strong>{" "}{polarisCopy.lead}</p>
            <p>{polarisCopy.observation}</p>
            <p className="landing-vnext__thesis">{polarisCopy.thesis}</p>
          </div>
          <AskPolarisWidget />
        </div>
      </div>
    </section>
  );
}
