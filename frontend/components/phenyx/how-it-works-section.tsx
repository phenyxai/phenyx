import { howItWorksCopy, SECTION_IDS } from "@/lib/landing-copy";

export function HowItWorksSection() {
  return (
    <section id={SECTION_IDS.how} className="landing-v66__section">
      <div className="landing-v66__inner">
        <p className="landing-v66__eyebrow">{howItWorksCopy.eyebrow}</p>
        <h2 className="landing-v66__section-headline">{howItWorksCopy.headline}</h2>
        <p className="landing-v66__section-lead">{howItWorksCopy.subline}</p>

        <div className="landing-v66__layers">
          {howItWorksCopy.cards.map((card) => (
            <article className="landing-v66__layer" key={card.layer}>
              <span className="landing-v66__dash" aria-hidden="true" />
              <p className="landing-v66__layer-tag">{card.layer}</p>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>

        <div className="landing-v66__dual-stack">
          <div className="landing-v66__dual-block">
            <p className="landing-v66__dual-label">{howItWorksCopy.analyzeLabel}</p>
            <div className="landing-v66__tags">
              {howItWorksCopy.analyzePills.map((pill) => <span key={pill}>{pill}</span>)}
            </div>
          </div>
          <div className="landing-v66__dual-block">
            <p className="landing-v66__dual-label">{howItWorksCopy.privacyLabel}</p>
            <div className="landing-v66__privacy-list">
              {howItWorksCopy.privacyItems.map((item) => (
                <div className="landing-v66__privacy-item" key={item.promise}>
                  <span aria-hidden="true" />
                  <p><strong>{item.promise}</strong> {item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
