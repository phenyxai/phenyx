"use client";

import { useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { ctaCopy, SECTION_IDS } from "@/lib/landing-copy";

interface CtaSectionProps {
  onEnterClick: () => void;
}

// ============================================================================
// CtaSection (#s0-cta) — the closing call-to-action on the landing page. Its
// `enter` button shares the single page-level `openEntryModal()` handler, so it
// opens the same Entry Choice Modal as the hero/nav/mobile-dropdown sources.
// ============================================================================
export function CtaSection({ onEnterClick }: CtaSectionProps) {
  const { sessionColor } = useSessionColor();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section
      id={SECTION_IDS.cta}
      className="w-full px-6 md:px-20"
      style={{
        paddingTop: "120px",
        paddingBottom: "120px",
        borderTop: "1px solid rgba(255,253,253,0.06)",
      }}
    >
      <div className="mx-auto flex flex-col items-center text-center" style={{ maxWidth: "720px" }}>
        <h2
          className="lowercase"
          style={{
            fontSize: "36px",
            fontWeight: 300,
            color: "#FFFDFD",
            lineHeight: 1.2,
            marginBottom: "16px",
          }}
        >
          {ctaCopy.headline}
        </h2>

        <p
          className="lowercase"
          style={{
            fontSize: "16px",
            fontWeight: 300,
            color: "rgba(255,253,253,0.6)",
            marginBottom: "40px",
          }}
        >
          {ctaCopy.subline}
        </p>

        <button
          onClick={onEnterClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="px-8 py-3 rounded-full lowercase transition-all"
          style={{
            fontSize: "13px",
            fontWeight: 400,
            letterSpacing: "0.1em",
            border: `1px solid ${isHovered ? `${sessionColor}E6` : `${sessionColor}80`}`,
            backgroundColor: isHovered ? sessionColor : "transparent",
            color: isHovered ? "#0A0A0A" : "#FFFDFD",
          }}
        >
          {ctaCopy.enter}
        </button>
      </div>
    </section>
  );
}
