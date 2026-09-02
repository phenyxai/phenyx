import { howItWorksCopy, SECTION_IDS } from "@/lib/landing-copy";

export function HowItWorksSection() {
  return (
    <section id={SECTION_IDS.how} className="s0-section">
      <div className="s0-inner">
        <p className="s0-eyebrow">{howItWorksCopy.eyebrow}</p>
        <h2 className="s0-how-headline">{howItWorksCopy.headline}</h2>
        <p className="s0-how-lede">{howItWorksCopy.lede}</p>

        <div className="s0-how-cards">
          {howItWorksCopy.layers.map((layer) => (
            <article className="how-step-card" key={layer.layer}>
              <p className="how-step-card__tag">{layer.layer}</p>
              <h3 className="how-step-card__title">{layer.title}</h3>
              <p className="how-step-card__body">{layer.body}</p>
            </article>
          ))}
        </div>

        <div className="s0-how-dual">
          <div className="s0-how-dual__block">
            <p className="s0-how-dual__label">{howItWorksCopy.whatComesIntoViewLabel}</p>
            <div className="s0-how-tags">
              {howItWorksCopy.whatComesIntoView.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="s0-how-dual__block">
            <p className="s0-how-dual__label">{howItWorksCopy.whatStaysYoursLabel}</p>
            <div className="s0-how-privacy">
              {howItWorksCopy.whatStaysYours.map((item) => (
                <div className="s0-how-privacy__item" key={item.heading}>
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
