"use client";

import { useState } from "react";
import { constellationPoints } from "@/lib/landing-copy";

export function ConstellationExample() {
  const [activeIndex, setActiveIndex] = useState(0);
  const point = constellationPoints[activeIndex];

  return (
    <div className="landing-vnext__example" data-reveal>
      <p className="landing-vnext__small-label">the same seven, seen by time</p>
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
        {point.star && (
          <div className="landing-vnext__north-star">
            <strong>{point.star}</strong>
            <span>{point.starSub}</span>
          </div>
        )}
        <div className="landing-vnext__evidence-rows">
          {point.rows.map(([when, source, evidence]) => (
            <div key={`${when}-${source}`}>
              <span>{when}</span><em>{source}</em><p>{evidence}</p>
            </div>
          ))}
        </div>
        <p className="landing-vnext__observation">{point.observation}</p>
      </div>
      <p className="landing-vnext__example-note">an example. yours is built only from the accounts you connect.</p>
    </div>
  );
}
