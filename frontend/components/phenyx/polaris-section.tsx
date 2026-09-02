"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

export function PolarisSection() {
  const { sessionColor } = useSessionColor();
  const [visibleElements, setVisibleElements] = useState<number[]>([]);
  const elementRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleElements([0, 1]);
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
      id="s0-polaris"
      className="w-full px-6 md:px-20"
      style={{
        backgroundColor: "#080808",
        paddingTop: "100px",
        paddingBottom: "100px",
      }}
    >
      <div className="mx-auto" style={{ maxWidth: "1100px" }}>
        {/* Eyebrow */}
        <p
          className="lowercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.5)",
            marginBottom: "26px",
          }}
        >
          polaris
        </p>

        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "clamp(32px, 4.6vw, 52px)",
            fontWeight: 400,
            lineHeight: 1.2,
            marginBottom: "24px",
            maxWidth: "740px",
            color: "#FFFDFD",
          }}
        >
          follow one thread all the way through
        </h2>

        {/* Body copy */}
        <div
          ref={(el) => { elementRefs.current[0] = el; }}
          className="lowercase"
          style={{ maxWidth: "680px", marginBottom: "36px", ...getAnimationStyle(0) }}
        >
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.7,
              color: "rgba(255,253,253,0.62)",
              fontWeight: 300,
              marginBottom: "22px",
            }}
          >
            the constellation lets you see yourself. polaris lets you use what you see. ask about something you keep returning to, or where it might be leading. polaris answers from the context already here, so you never start by explaining yourself.
          </p>
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.7,
              color: "rgba(255,253,253,0.62)",
              fontWeight: 300,
              marginBottom: "22px",
            }}
          >
            and when you arrive with no question, a few things come forward on their own.
          </p>
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.7,
              color: "#FFFDFD",
              fontWeight: 500,
            }}
          >
            you bring the question. the context is already here.
          </p>
        </div>

        {/* Example card */}
        <div
          ref={(el) => { elementRefs.current[1] = el; }}
          style={{
            background: "#121212",
            border: "1px solid #2e2e2e",
            borderRadius: "14px",
            padding: "32px 40px",
            maxWidth: "620px",
            ...getAnimationStyle(1),
          }}
        >
          {/* Card header */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                width: "24px",
                height: "1px",
                backgroundColor: sessionColor,
                marginBottom: "16px",
              }}
            />
            <p
              className="lowercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.18em",
                color: "rgba(255,253,253,0.5)",
                marginBottom: "12px",
              }}
            >
              convergence
            </p>
            <p
              className="lowercase"
              style={{
                fontSize: "17px",
                fontWeight: 500,
                color: "#FFFDFD",
                lineHeight: 1.5,
                marginBottom: "16px",
              }}
            >
              &quot;am i moving as fast as i think i am?&quot;
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
              you tend to describe the work as fast, but what you save and return to has slowed steadily across three years, on both accounts.
            </p>
          </div>

          {/* Card footer */}
          <div
            style={{
              borderTop: "1px solid #2e2e2e",
              paddingTop: "16px",
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              fontSize: "13px",
              color: "rgba(255,253,253,0.5)",
            }}
          >
            <span className="lowercase">spotify, pinterest</span>
            <span style={{ color: "rgba(255,253,253,0.3)" }}>•</span>
            <span className="lowercase">3 years / 2 sources</span>
          </div>
        </div>
      </div>
    </section>
  );
}
