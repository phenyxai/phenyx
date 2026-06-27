"use client";

import { useEffect, useRef, useState } from "react";
import { PlatformField } from "./platform-field";

/**
 * "a first look" / "who are you, really?" — repurposed from the old manifesto
 * section. Two-column grid: reference about copy on the left, the floating
 * platform field on the right. Keeps the IntersectionObserver fade-in.
 */
export function AboutSection() {
  const [visibleParagraphs, setVisibleParagraphs] = useState<number[]>([]);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleParagraphs([0, 1, 2, 3]);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = paragraphRefs.current.indexOf(
              entry.target as HTMLParagraphElement
            );
            if (index !== -1) {
              setVisibleParagraphs((prev) =>
                prev.includes(index) ? prev : [...prev, index]
              );
            }
          }
        });
      },
      { threshold: 0.2 }
    );

    paragraphRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const getAnimationStyle = (index: number) => {
    if (prefersReducedMotion) {
      return { opacity: 1 };
    }
    const isVisible = visibleParagraphs.includes(index);
    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 600ms ease-out, transform 600ms ease-out",
    };
  };

  return (
    <section id="s0-about" className="w-full px-6 md:px-20" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
      <div className="mx-auto" style={{ maxWidth: "1100px" }}>
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
          a first look
        </p>

        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "clamp(32px, 4.6vw, 52px)",
            fontWeight: 400,
            lineHeight: 1.16,
            marginBottom: "24px",
            maxWidth: "760px",
            color: "#FFFDFD",
          }}
        >
          who are you, really?
        </h2>

        {/* Two-column grid: copy + platform field */}
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="lowercase" style={{ maxWidth: "560px" }}>
            <p
              ref={(el) => { paragraphRefs.current[0] = el; }}
              style={{
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "rgba(255,253,253,0.62)",
                marginBottom: "22px",
                ...getAnimationStyle(0),
              }}
            >
              every platform gave you a box.
            </p>
            <p
              ref={(el) => { paragraphRefs.current[1] = el; }}
              style={{
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "rgba(255,253,253,0.62)",
                marginBottom: "22px",
                ...getAnimationStyle(1),
              }}
            >
              linkedin made you a professional. instagram made you an aesthetic. tiktok made you a moment. x made you an opinion.
            </p>
            <p
              ref={(el) => { paragraphRefs.current[2] = el; }}
              style={{
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "rgba(255,253,253,0.62)",
                marginBottom: "22px",
                ...getAnimationStyle(2),
              }}
            >
              you have built a life across the internet, but no one has ever shown you what it all adds up to.
            </p>
            <p
              ref={(el) => { paragraphRefs.current[3] = el; }}
              style={{
                fontSize: "17px",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "rgba(255,253,253,0.62)",
                marginBottom: 0,
                ...getAnimationStyle(3),
              }}
            >
              <strong style={{ color: "#FFFDFD", fontWeight: 700 }}>
                <span className="uppercase">PHENYX</span> does.
              </strong>
            </p>
          </div>

          <PlatformField />
        </div>
      </div>
    </section>
  );
}
