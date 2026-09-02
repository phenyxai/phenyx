"use client";

import { useEffect, useRef } from "react";
import { howItWorksCopy, SECTION_IDS } from "@/lib/landing-copy";

const SIGNAL_Y = [0.62, 0.24, 0.8, 0.3, 0.12, 0.54];

export function HowItWorksSection() {
  const listRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const draw = () => {
      const list = listRef.current;
      const path = pathRef.current;
      if (!list || !path) return;
      const listBox = list.getBoundingClientRect();
      const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-signal-node]"));
      const points = nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return `${box.left - listBox.left + box.width / 2},${box.top - listBox.top + box.height / 2}`;
      });
      path.setAttribute("points", points.join(" "));
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (listRef.current) observer.observe(listRef.current);
    window.addEventListener("resize", draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, []);

  return (
    <section id={SECTION_IDS.how} className="landing-vnext__section">
      <div className="landing-vnext__inner">
        <p className="landing-vnext__eyebrow" data-reveal>{howItWorksCopy.eyebrow}</p>
        <h2 data-reveal>{howItWorksCopy.headline}</h2>
        <p className="landing-vnext__section-lead" data-reveal>{howItWorksCopy.subline}</p>

        <div className="landing-vnext__how" data-reveal>
          <div className="landing-vnext__steps">
            {howItWorksCopy.cards.map((card) => (
              <article className="landing-vnext__step" key={card.layer}>
                <p className="landing-vnext__small-label">{card.layer}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>

          <article className="landing-vnext__how-band">
            <div>
              <p className="landing-vnext__small-label">{howItWorksCopy.signalsLabel}</p>
              <div ref={listRef} className="landing-vnext__signals">
                <svg aria-hidden="true" preserveAspectRatio="none">
                  <polyline ref={pathRef} fill="none" vectorEffect="non-scaling-stroke" />
                </svg>
                {howItWorksCopy.signals.map((signal, index) => (
                  <span key={signal}>
                    <i data-signal-node style={{ "--signal-y": SIGNAL_Y[index] } as React.CSSProperties} />
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <div className="landing-vnext__privacy">
              <p className="landing-vnext__small-label">{howItWorksCopy.privacyLabel}</p>
              <div className="landing-vnext__privacy-grid">
                {howItWorksCopy.privacyItems.map((item) => (
                  <div key={item.promise}>
                    <h4>{item.promise}</h4>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
