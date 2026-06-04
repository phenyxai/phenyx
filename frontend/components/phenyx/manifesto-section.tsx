"use client";

import { useEffect, useRef, useState } from "react";

export function ManifestoSection() {
  const [visibleParagraphs, setVisibleParagraphs] = useState<number[]>([]);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setVisibleParagraphs([0, 1, 2]);
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
      id="manifesto" 
      className="w-full px-6 md:px-20"
      style={{ 
        paddingTop: "80px", 
        paddingBottom: "80px", 
      }}
    >
      <div 
        className="mx-auto"
        style={{ maxWidth: "1100px" }}
      >
      <div 
        style={{ maxWidth: "720px" }}
      >
        {/* Body paragraphs - 20px, weight 300, line height 1.7, 32px spacing */}
        <div className="flex flex-col lowercase" style={{ gap: "32px" }}>
          <p
            ref={(el) => { paragraphRefs.current[0] = el; }}
            style={{
              fontSize: "20px",
              fontWeight: 300,
              lineHeight: 1.7,
              color: "rgba(255,253,253,0.9)",
              ...getAnimationStyle(0),
            }}
          >
            every platform gave you a box. linkedin made you a professional. instagram made you an aesthetic. tiktok made you a moment. x made you an opinion.
          </p>

          <p
            ref={(el) => { paragraphRefs.current[1] = el; }}
            style={{
              fontSize: "20px",
              fontWeight: 300,
              lineHeight: 1.7,
              color: "rgba(255,253,253,0.9)",
              ...getAnimationStyle(1),
            }}
          >
            you have built a life across the internet, but no platform has ever shown you what it adds up to.
          </p>

          {/* Emphasis paragraph - 20px, weight 600 */}
          <p
            ref={(el) => { paragraphRefs.current[2] = el; }}
            style={{
              fontSize: "20px",
              fontWeight: 600,
              lineHeight: 1.7,
              color: "#FFFDFD",
              ...getAnimationStyle(2),
            }}
          >
            <span className="uppercase">PHENYX</span> shows you who you are across your digital life.
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}
