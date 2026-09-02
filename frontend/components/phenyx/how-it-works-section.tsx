import { howItWorksCopy, SECTION_IDS } from "@/lib/landing-copy";

export function HowItWorksSection() {
  return (
    <section id={SECTION_IDS.how} className="landing-v66__section">
      <div className="landing-v66__inner">
        <p className="landing-v66__eyebrow">{howItWorksCopy.eyebrow}</p>
        <h2 className="landing-v66__section-headline">{howItWorksCopy.headline}</h2>
        <p className="landing-v66__section-lead">{howItWorksCopy.lede}</p>

        <div className="landing-v66__layers">
          {howItWorksCopy.layers.map((layer) => (
            <article className="landing-v66__layer" key={layer.layer}>
              <span className="landing-v66__dash" aria-hidden="true" />
              <p className="landing-v66__layer-tag">{layer.layer}</p>
              <h3>{layer.title}</h3>
              <p>{layer.body}</p>
            </article>
          ))}
        </div>

        <div className="landing-v66__dual-stack">
          <div className="landing-v66__dual-block">
            <p className="landing-v66__dual-label">{howItWorksCopy.whatComesIntoViewLabel}</p>
            <div className="landing-v66__tags">
              {howItWorksCopy.whatComesIntoView.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="landing-v66__dual-block">
            <p className="landing-v66__dual-label">{howItWorksCopy.whatStaysYoursLabel}</p>
            <div className="landing-v66__privacy-list">
              {howItWorksCopy.whatStaysYours.map((item) => (
                <div className="landing-v66__privacy-item" key={item.heading}>
                  <span aria-hidden="true" />
                  <p><strong>{item.heading}</strong> {item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
