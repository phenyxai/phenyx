"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

const layers = [
  {
    tag: "connect",
    title: "connect",
    text: "what you listen to, watch, save, post and build, from only the places you choose.",
  },
  {
    tag: "assemble",
    title: "assemble",
    text: "everything lands on one timeline, so repeats and shifts finally sit next to each other.",
  },
  {
    tag: "reveal",
    title: "reveal",
    text: "the shape no single account could show, with the moments and evidence that made it visible.",
  },
];

const comesIntoView = [
  "what keeps returning",
  "what overlaps",
  "creative rhythms",
  "turning points",
  "how you decide",
  "what stays with you",
];

const staysYours = [
  { title: "your control", text: "choose what comes in. disconnect whenever you want." },
  { title: "your privacy", text: "PHENYX keeps what it learned from your accounts, never a second copy of them." },
  { title: "your meaning", text: "PHENYX can show what is there. what it means stays yours." },
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
          connect, assemble, reveal
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
          three layers, and nothing invented in any of them.
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
                className="lowercase"
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

        {/* Dual stack — what comes into view / what stays yours */}
        <div
          style={{
            background: "#121212",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {/* what comes into view */}
          <div
            ref={(el) => { elementRefs.current[3] = el; }}
            style={{
              padding: "40px 44px",
              borderBottom: "1px solid #2e2e2e",
              ...getAnimationStyle(3),
            }}
          >
            <p
              className="lowercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,253,253,0.5)",
                marginBottom: "24px",
              }}
            >
              what comes into view
            </p>
            <div className="flex flex-wrap" style={{ gap: "12px" }}>
              {comesIntoView.map((tag) => (
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

          {/* what stays yours */}
          <div
            ref={(el) => { elementRefs.current[4] = el; }}
            style={{
              padding: "40px 44px",
              ...getAnimationStyle(4),
            }}
          >
            <p
              className="lowercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,253,253,0.5)",
                marginBottom: "24px",
              }}
            >
              what stays yours
            </p>
            <div className="flex flex-col" style={{ gap: "18px" }}>
              {staysYours.map((item, i) => (
                <div key={i}>
                  <p
                    className="lowercase"
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#FFFDFD",
                      marginBottom: "6px",
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="lowercase"
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.75,
                      color: "rgba(255,253,253,0.62)",
                      fontWeight: 300,
                    }}
                  >
                    {item.text}
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
