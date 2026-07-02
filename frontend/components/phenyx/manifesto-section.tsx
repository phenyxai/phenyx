"use client";

import { useEffect, useRef, useState } from "react";
import { manifestoCopy, BRAND, SECTION_IDS } from "@/lib/landing-copy";
import { PlatformField } from "./platform-field";

export function ManifestoSection() {
  const [visibleParagraphs, setVisibleParagraphs] = useState<number[]>([]);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleParagraphs([0, 1, 2, 3, 4, 5]);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = paragraphRefs.current.indexOf(entry.target as HTMLParagraphElement);
            if (index !== -1 && !visibleParagraphs.includes(index)) {
              setVisibleParagraphs((prev) => [...prev, index]);
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
  }, [visibleParagraphs]);

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
    <section
      id={SECTION_IDS.about}
      className="w-full px-6 md:px-20"
      style={{
        paddingTop: "80px",
        paddingBottom: "80px",
      }}
    >
      <div
        className="mx-auto flex flex-col gap-12 min-[781px]:flex-row min-[781px]:items-center min-[781px]:gap-16"
        style={{ maxWidth: "1100px" }}
      >
      {/* Text column — DOM-first, but ordered below the platform field at ≤780px */}
      <div
        className="order-2 min-[781px]:order-1 min-[781px]:flex-1"
        style={{ maxWidth: "720px" }}
      >
        {/* Eyebrow */}
        <p
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "rgba(255,253,253,0.6)",
            marginBottom: "32px",
          }}
        >
          {manifestoCopy.eyebrow}
        </p>

        {/* Body paragraphs - 20px, weight 300, line height 1.7, 32px spacing */}
        <div className="flex flex-col lowercase" style={{ gap: "32px" }}>
          {manifestoCopy.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              ref={(el) => { paragraphRefs.current[index] = el; }}
              style={{
                fontSize: "20px",
                fontWeight: 300,
                lineHeight: 1.7,
                color: "rgba(255,253,253,0.9)",
                ...getAnimationStyle(index),
              }}
            >
              {paragraph}
            </p>
          ))}

          {/* Emphasis paragraph - 20px, weight 600 */}
          <p
            ref={(el) => { paragraphRefs.current[manifestoCopy.paragraphs.length] = el; }}
            style={{
              fontSize: "20px",
              fontWeight: 600,
              lineHeight: 1.7,
              color: "#FFFDFD",
              ...getAnimationStyle(manifestoCopy.paragraphs.length),
            }}
          >
            <span className="uppercase">{BRAND}</span> {manifestoCopy.emphasisSuffix}
          </p>
        </div>
      </div>

      {/* Floating platform-icon field — a 260px block above the text at ≤780px,
          the right column at >780px. Decorative (aria-hidden lives inside). */}
      <div className="order-1 min-[781px]:order-2 w-full h-[260px] min-[781px]:w-[380px] min-[781px]:h-[420px] shrink-0">
        <PlatformField prefersReducedMotion={prefersReducedMotion} />
      </div>
      </div>
    </section>
  );
}
