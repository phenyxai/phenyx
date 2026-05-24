"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

const cards = [
  {
    layer: "layer one",
    title: "connect",
    body: "oauth integrations with instagram, linkedin, tiktok, x, spotify, youtube, github, and more. we read what you have already made, said, and shared across the internet.",
    radiusDesktop: "12px 0 0 0",
    radiusMobile: "12px",
  },
  {
    layer: "layer two",
    title: "synthesize",
    body: "our AI analyzes tone, language patterns, content themes, and pivotal moments across all sources. it finds the through-line in everything you have built and maps it to the seven pillars of your identity formation.",
    radiusDesktop: "0",
    radiusMobile: "0",
  },
  {
    layer: "layer three",
    title: "reflect",
    body: "the AI returns not a summary but a pattern. something that lands as i did not have words for that until now. it asks questions earned from your data, not generated from a template.",
    radiusDesktop: "0 12px 0 0",
    radiusMobile: "12px",
  },
];

const analyzePills = [
  "tone and voice",
  "pivotal moments",
  "content evolution",
  "career transitions",
  "creative output",
  "the people you keep returning to.",
  "language over time",
];

const neverDoItems = [
  "store raw platform data. we process and discard. only synthesized insights are retained.",
  "access without consent. every connection is oauth-authorized and revocable at any time.",
  "assign you a label. PHENYX reflects. it never categorizes.",
];

export function HowItWorksSection() {
  const { sessionColor } = useSessionColor();
  const [visibleElements, setVisibleElements] = useState<number[]>([]);
  const elementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    setIsDesktop(desktopQuery.matches);
    const handleDesktopChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    desktopQuery.addEventListener("change", handleDesktopChange);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleElements([0, 1, 2, 3, 4, 5]);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = elementRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setTimeout(() => {
                setVisibleElements((prev) => 
                  prev.includes(index) ? prev : [...prev, index]
                );
              }, index * 100);
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    elementRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
      desktopQuery.removeEventListener("change", handleDesktopChange);
    };
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
      className="w-full"
      style={{
        backgroundColor: "#0A0A0A",
        paddingTop: "100px",
        paddingBottom: "100px",
      }}
    >
      <div
        className="mx-auto px-6 md:px-20"
        style={{ maxWidth: "1100px" }}
      >
        {/* Label */}
        <p
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.6)",
            marginBottom: "24px",
          }}
        >
          how it works
        </p>

        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "32px",
            fontWeight: 300,
            color: "#FFFDFD",
            lineHeight: 1.2,
            maxWidth: "600px",
            marginBottom: "16px",
          }}
        >
          we synthesize who you are across everything you have built.
        </h2>

        {/* Subline */}
        <p
          className="lowercase"
          style={{
            fontSize: "16px",
            fontWeight: 300,
            color: "rgba(255,253,253,0.5)",
            maxWidth: "560px",
            lineHeight: 1.7,
            marginBottom: "64px",
          }}
        >
          connect your platforms or tell us your story. either way <span className="uppercase font-light">PHENYX COLLECTIVE</span> reads the patterns others miss and reflects back a portrait only you could have.
        </p>

        {/* Three cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[2px]">
          {cards.map((card, index) => (
            <div
              key={card.layer}
              ref={(el) => { elementRefs.current[index] = el; }}
              style={{
                backgroundColor: "#111111",
                border: "1px solid rgba(255,253,253,0.07)",
                padding: "32px",
                borderRadius: isDesktop ? card.radiusDesktop : card.radiusMobile,
                ...getAnimationStyle(index),
              }}
              className="md:rounded-none"
            >
              {/* Accent line using session color */}
              <div
                style={{
                  width: "32px",
                  height: "1px",
                  backgroundColor: sessionColor,
                  marginBottom: "24px",
                }}
              />

              {/* Layer label */}
              <p
                className="uppercase"
                style={{
                  fontSize: "11px",
letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
                marginBottom: "12px",
                }}
              >
                {card.layer}
              </p>

              {/* Title */}
              <h3
                className="lowercase"
                style={{
                  fontSize: "18px",
                  fontWeight: 400,
                  color: "#FFFDFD",
                  marginBottom: "16px",
                }}
              >
                {card.title}
              </h3>

              {/* Body */}
              <p
                className="lowercase"
                style={{
                  fontSize: "14px",
                  color: "rgba(255,253,253,0.5)",
                  lineHeight: 1.7,
                }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </div>

        {/* Two panels below */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[2px] mt-[2px]">
          {/* Left panel - What we analyze */}
          <div
            ref={(el) => { elementRefs.current[3] = el; }}
            className="md:rounded-bl-[12px]"
            style={{
              padding: "32px",
              backgroundColor: "#111111",
              border: "1px solid rgba(255,253,253,0.07)",
              ...getAnimationStyle(3),
            }}
          >
            <p
              className="uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                color: "rgba(255,253,253,0.6)",
                marginBottom: "16px",
              }}
            >
              what we analyze
            </p>

            <div className="flex flex-wrap gap-2">
              {analyzePills.map((pill) => (
                <span
                  key={pill}
                  className="lowercase"
                  style={{
                    border: "1px solid rgba(255,253,253,0.12)",
                    borderRadius: "999px",
                    padding: "4px 14px",
                    fontSize: "12px",
                    color: "rgba(255,253,253,0.55)",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Right panel - What we never do */}
          <div
            ref={(el) => { elementRefs.current[4] = el; }}
            className="md:rounded-br-[12px]"
            style={{
              padding: "32px",
              backgroundColor: "#111111",
              border: "1px solid rgba(255,253,253,0.07)",
              ...getAnimationStyle(4),
            }}
          >
            <p
              className="uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                color: "rgba(255,253,253,0.6)",
                marginBottom: "16px",
              }}
            >
              what we never do
            </p>

            <div className="flex flex-col gap-[10px]">
              {neverDoItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div
                    style={{
                      width: "14px",
                      height: "1px",
                      backgroundColor: "rgba(232,69,30,0.5)",
                      marginTop: "10px",
                      flexShrink: 0,
                    }}
                  />
                  <p
                    className="lowercase"
                    style={{
                      fontSize: "14px",
                      color: "rgba(255,253,253,0.5)",
                      lineHeight: 1.5,
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
