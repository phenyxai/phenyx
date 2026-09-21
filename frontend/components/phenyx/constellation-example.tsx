"use client";

import { useState } from "react";
import { constellationCopy, constellationPoints } from "@/lib/landing-copy";

export function ConstellationExample() {
  const [activeIndex, setActiveIndex] = useState(0);
  const point = constellationPoints[activeIndex];

  return (
    <div className="landing-vnext__example" data-reveal>
      {/* The disclaimer leads: say it is an example before showing one. */}
      <p className="landing-vnext__example-note">{constellationCopy.exampleNote}</p>
      <p className="landing-vnext__small-label">{constellationCopy.exampleToggleLabel}</p>
      <div className="landing-vnext__example-tabs" role="tablist" aria-label="the seven points">
        {constellationPoints.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            data-active={index === activeIndex}
            data-ahead={index === constellationPoints.length - 1}
            onClick={() => setActiveIndex(index)}
          >
            <i aria-hidden="true" />
            <span>{item.name}</span>
            <small>{item.year}</small>
          </button>
        ))}
      </div>
      <div className="landing-vnext__example-body" key={point.name} role="tabpanel">
        <h3>{point.question}</h3>
        <p>{point.summary}</p>
        <div className="landing-vnext__evidence-rows">
          {point.rows.map(([label, source, evidence]) => (
            <div key={`${label}-${source}`}>
              <span>{label}</span><em>{source}</em><p>{evidence}</p>
            </div>
          ))}
        </div>
        <p className="landing-vnext__observation">{point.observation}</p>
      </div>
    </div>
  );
}
