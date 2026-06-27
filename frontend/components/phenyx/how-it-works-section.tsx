"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

const layers = [
  {
    tag: "layer one",
    title: "connect",
    text: "oauth integrations with instagram, linkedin, pinterest, x, spotify, youtube, github, and more. we read what you have already made, said, and shared, with your permission.",
  },
  {
    tag: "layer two",
    title: "synthesize",
    text: "our ai analyzes tone, language patterns, content themes, and pivotal moments across all sources. it finds the pattern that ties it all together.",
  },
  {
    tag: "layer three",
    title: "reveal",
    text: "we surface observations based on your behavior, each one tied to a point on your constellation. polaris, our ai, is connected to all of it, helping you explore what it finds and what it means.",
  },
];

const analyzeTags = [
  "tone and voice",
  "pivotal moments",
  "content evolution",
  "career transitions",
  "creative output",
  "network patterns",
  "language over time",
];

const neverDoItems = [
  "store raw platform data. we process and discard. only synthesized insights are retained.",
  "access without consent. every connection is oauth-authorized and revocable at any time.",
  "assign you a label. the ai reflects. it does not categorize.",
];

export function HowItWorksSection() {
  const { sessionColor } = useSessionColor();
  const [visibleElements, setVisibleElements] = useState<number[]>([]);
  const elementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleElements([0, 1, 2, 3, 4]);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = elementRefs.current.indexOf(
              entry.target as HTMLDivElement
            );
            if (index !== -1) {
              setVisibleElements((prev) =>
                prev.includes(index) ? prev : [...prev, index]
              );
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    elementRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const getAnimationStyle = (index: number) => {
    if (prefersReducedMotion) {
      return { opacity: 1, transform: "translateY(0)" };
    }
    const isVisible = visibleElements.includes(index);
    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(16px)",
      transition: "opacity 600ms ease-out, transform 600ms ease-out",
    };
  };

  return (
    <section
      id="s0-how"
      className="w-full"
      style={{
        backgroundColor: "#0A0A0A",
        paddingTop: "100px",
        paddingBottom: "100px",
      }}
    >
      <div className="mx-auto px-6 md:px-20" style={{ maxWidth: "1100px" }}>
        {/* Eyebrow */}
        <p
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.5)",
            marginBottom: "26px",
          }}
        >
          how it works
        </p>

        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "clamp(32px, 4.6vw, 52px)",
            fontWeight: 400,
            color: "#FFFDFD",
            lineHeight: 1.2,
            maxWidth: "740px",
            marginBottom: "24px",
          }}
        >
          connect. synthesize. reveal.
        </h2>

        {/* Subline */}
        <p
          className="lowercase"
          style={{
            fontSize: "17px",
            fontWeight: 300,
            color: "rgba(255,253,253,0.62)",
            maxWidth: "680px",
            lineHeight: 1.7,
            marginBottom: "36px",
          }}
        >
          we help you make sense of it all, through three layers.
        </p>

        {/* Three layers — vertical stack inside one card */}
        <div
          style={{
            background: "#121212",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {layers.map((layer, index) => (
            <div
              key={layer.tag}
              ref={(el) => { elementRefs.current[index] = el; }}
              style={{
                padding: "40px 44px",
                borderBottom:
                  index < layers.length - 1 ? "1px solid #2e2e2e" : "none",
                ...getAnimationStyle(index),
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "1px",
                  backgroundColor: sessionColor,
                  marginBottom: "26px",
                }}
              />
              <p
                className="uppercase"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  color: "rgba(255,253,253,0.5)",
                  marginBottom: "14px",
                }}
              >
                {layer.tag}
              </p>
              <h3
                className="lowercase"
                style={{
                  fontSize: "24px",
                  fontWeight: 500,
                  color: "#FFFDFD",
                  marginBottom: "18px",
                }}
              >
                {layer.title}
              </h3>
              <p
                className="lowercase"
                style={{
                  fontSize: "15px",
                  color: "rgba(255,253,253,0.62)",
                  lineHeight: 1.75,
                  fontWeight: 300,
                  maxWidth: "760px",
                }}
              >
                {layer.text}
              </p>
            </div>
          ))}
        </div>

        <div style={{ height: "28px" }} />

        {/* Dual stack — what we analyze / what we never do */}
        <div
          style={{
            background: "#121212",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {/* what we analyze */}
          <div
            ref={(el) => { elementRefs.current[3] = el; }}
            style={{
              padding: "40px 44px",
              borderBottom: "1px solid #2e2e2e",
              ...getAnimationStyle(3),
            }}
          >
            <p
              className="uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,253,253,0.5)",
                marginBottom: "24px",
              }}
            >
              what we analyze
            </p>
            <div className="flex flex-wrap" style={{ gap: "12px" }}>
              {analyzeTags.map((tag) => (
                <span
                  key={tag}
                  className="lowercase"
                  style={{
                    fontSize: "14px",
                    padding: "11px 22px",
                    border: "1px solid #2e2e2e",
                    borderRadius: "24px",
                    color: "rgba(255,253,253,0.62)",
                    background: "transparent",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* what we never do */}
          <div
            ref={(el) => { elementRefs.current[4] = el; }}
            style={{
              padding: "40px 44px",
              ...getAnimationStyle(4),
            }}
          >
            <p
              className="uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,253,253,0.5)",
                marginBottom: "24px",
              }}
            >
              what we never do
            </p>
            <div className="flex flex-col" style={{ gap: "18px" }}>
              {neverDoItems.map((item, i) => (
                <div key={i} className="flex items-start" style={{ gap: "16px" }}>
                  <span
                    style={{
                      width: "16px",
                      height: "1px",
                      background: "#a26656",
                      flexShrink: 0,
                      marginTop: "11px",
                    }}
                  />
                  <p
                    className="lowercase"
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.75,
                      color: "rgba(255,253,253,0.62)",
                      fontWeight: 300,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
