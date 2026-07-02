"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { howItWorksCopy, BRAND, SECTION_IDS } from "@/lib/landing-copy";

const { cards, analyzePills, neverDoItems } = howItWorksCopy;

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
      id={SECTION_IDS.how}
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
          {howItWorksCopy.eyebrow}
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
          {howItWorksCopy.headline}
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
          {howItWorksCopy.sublinePrefix}<span className="uppercase font-light">{BRAND}</span>{howItWorksCopy.sublineSuffix}
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
              {howItWorksCopy.analyzeLabel}
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
              {howItWorksCopy.neverDoLabel}
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
